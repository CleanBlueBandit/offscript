import assert from "node:assert/strict";
import test from "node:test";
import type { Candidate } from "@google/genai";
import { collectRetrievedResearch, parsePublicSearchResults, researchDemo, researchLive, researchPublicWeb, researchWithFallback, withResearchDeadline } from "../lib/research";
import {
  normalizePublicUrl,
  researchEvidenceSchema,
  researchExtractionSchema,
  researchRequestSchema,
  researchRunSchema,
  researchStateSchema,
} from "../lib/research-validation";
import { ApiError } from "../lib/validation";

const input = { query: "reduce food waste", mode: "web" as const, urls: [], demo: false };
const sourceUrl = "https://devpost.com/software/pantry-exchange";
const excerpt = "Pantry Exchange matches surplus pantry items with nearby households through a location-based listing.";
function searchCandidate(): Candidate {
  return {
    content: { role: "model", parts: [{ text: excerpt }] },
    groundingMetadata: {
      groundingChunks: [{ web: { uri: sourceUrl, title: "Pantry Exchange hackathon project" } }],
      groundingSupports: [{ groundingChunkIndices: [0], segment: { text: excerpt } }],
      webSearchQueries: ["food waste hackathon project"],
      searchEntryPoint: { renderedContent: "<div>Google Search suggestions</div>" },
    },
  };
}
const extraction = {
  summary: "A public project describes a local surplus-sharing workflow.",
  findings: [{
    title: "Nearby surplus matching", problem: "Households have spare pantry items.",
    feature: "A location-based listing matches surplus items to nearby households.",
    howItWorks: "A household lists an item and a nearby household can find it.",
    adaptation: "Proposed adaptation: test a small neighbor-to-neighbor pantry exchange.",
    sourceIds: ["source-1"], kind: "feature",
  }],
  limitations: ["The retrieved description does not establish adoption or user demand."],
};

test("public page validation rejects local, IP, credential-bearing and non-web URLs", () => {
  for (const url of [
    "http://localhost/", "http://localhost.localdomain/", "http://127.0.0.1/",
    "http://2130706433/", "http://0x7f000001/", "http://192.168.1.1/",
    "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://metadata.google.internal/",
    "https://example.local/", "https://intranet/", "https://127.0.0.1.nip.io/",
    "https://user:password@devpost.com/", "https://devpost.com:444/",
    "https://devpost.com/?api_key=secret", "https://devpost.com/?accessToken=secret",
    "https://devpost.com/#access_token=secret", "file:///etc/passwd", "javascript:alert(1)",
  ]) assert.equal(normalizePublicUrl(url), null, url);
  assert.equal(normalizePublicUrl("https://devpost.com/software/project#features"), "https://devpost.com/software/project");
  assert.equal(normalizePublicUrl("https://www.example.com:443/?q=robotics"), "https://www.example.com/?q=robotics");
});

test("research modes validate query, URL count, duplicates and unsafe query links", () => {
  assert.equal(researchRequestSchema.safeParse(input).success, true);
  assert.equal(researchRequestSchema.safeParse({ ...input, mode: "hackathons" }).success, true);
  assert.equal(researchRequestSchema.safeParse({ ...input, query: "", mode: "urls", urls: [sourceUrl] }).success, true);
  for (const invalid of [
    { ...input, query: "" }, { ...input, mode: "urls" },
    { ...input, mode: "anything" }, { ...input, urls: [sourceUrl, sourceUrl] },
    { ...input, urls: Array.from({ length: 6 }, (_, index) => `https://devpost.com/project-${index}`) },
    { ...input, query: "Read http://localhost:5173/private please" },
    { ...input, query: "Read https://example.com/?token=private please" },
  ]) assert.equal(researchRequestSchema.safeParse(invalid).success, false);
});

test("source collection preserves citation mapping and provider attribution", () => {
  const candidate = searchCandidate();
  candidate.groundingMetadata!.groundingChunks!.push({ web: { uri: "https://example.com/uncited", title: "Uncited result" } });
  const result = collectRetrievedResearch(candidate, "hackathons");
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].url, sourceUrl);
  assert.equal(result.sources[0].kind, "hackathon");
  assert.equal(result.sources[0].access, "search");
  assert.deepEqual(result.evidence, [{ sourceId: result.sources[0].id, excerpts: [excerpt] }]);
  assert.equal(result.searchEntryPoint, candidate.groundingMetadata!.searchEntryPoint!.renderedContent);
  assert.ok(result.limitations.some((item) => item.includes("attributable")));
});

test("grounded byte spans handle non-ASCII text without changing source attribution", () => {
  const text = `ქართული შესავალი. ${excerpt}`;
  const offset = new TextEncoder().encode("ქართული შესავალი. ").length;
  const candidate = searchCandidate();
  candidate.content!.parts = [{ text }];
  candidate.groundingMetadata!.groundingSupports![0].segment = { startIndex: offset, endIndex: new TextEncoder().encode(text).length, partIndex: 0 };
  assert.equal(collectRetrievedResearch(candidate, "web").evidence[0].excerpts[0], excerpt);
});

test("URL Context accepts only successful metadata entries with per-page attribution", () => {
  const candidate: Candidate = {
    content: { parts: [{ text: `SOURCE: ${sourceUrl}\n${excerpt}\nSOURCE: https://example.com/unread\nInvented content must be discarded.` }] },
    urlContextMetadata: { urlMetadata: [
      { retrievedUrl: sourceUrl, urlRetrievalStatus: "URL_RETRIEVAL_STATUS_SUCCESS" as never },
      { retrievedUrl: "https://example.com/unread", urlRetrievalStatus: "URL_RETRIEVAL_STATUS_ERROR" as never },
    ] },
  };
  const result = collectRetrievedResearch(candidate, "urls");
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].access, "retrieved");
  assert.equal(result.evidence[0].excerpts[0], excerpt);
  assert.ok(result.limitations.some((item) => item.includes("could not be read")));
  candidate.content!.parts = [{ text: "A general summary without per-page attribution cannot support extraction." }];
  assert.throws(() => collectRetrievedResearch(candidate, "urls"), (error) => error instanceof ApiError && error.code === "RESEARCH_NO_SOURCES");
});

test("metadata-less or unsafe sources cannot become live research", () => {
  assert.throws(() => collectRetrievedResearch({ content: { parts: [{ text: `I found ${sourceUrl}` }] } }, "web"), (error) => error instanceof ApiError && error.code === "RESEARCH_NO_SOURCES");
  const candidate = searchCandidate();
  candidate.groundingMetadata!.groundingChunks![0].web!.uri = "http://127.0.0.1/private";
  assert.throws(() => collectRetrievedResearch(candidate, "web"), (error) => error instanceof ApiError && error.code === "RESEARCH_NO_SOURCES");
});

test("extraction and saved evidence reject invented, missing and duplicate citation IDs", () => {
  const validator = researchExtractionSchema(["source-1"]);
  assert.equal(validator.safeParse(extraction).success, true);
  for (const sourceIds of [[], ["invented"], ["source-1", "source-1"]])
    assert.equal(validator.safeParse({ ...extraction, findings: [{ ...extraction.findings[0], sourceIds }] }).success, false);
  const evidence = {
    ...extraction.findings[0], id: "finding-1", collectedAt: Date.now(),
    sources: collectRetrievedResearch(searchCandidate(), "web").sources,
  };
  assert.equal(researchEvidenceSchema.safeParse(evidence).success, true);
  assert.equal(researchEvidenceSchema.safeParse({ ...evidence, sourceIds: ["forged"] }).success, false);
  assert.equal(researchEvidenceSchema.safeParse({ ...evidence, sources: [] }).success, false);
});

test("demo is explicitly illustrative, has no fabricated sources and obeys state limits", () => {
  const run = researchDemo({ ...input, query: "x".repeat(1200), demo: true });
  assert.equal(run.source, "demo");
  assert.equal(run.sources.length, 0);
  assert.ok(run.findings.every((finding) => finding.sourceIds.length === 0));
  assert.ok(run.summary.includes("No websites were searched"));
  assert.equal(researchRunSchema.safeParse({ ...run, source: "live" }).success, false);
  assert.equal(researchRunSchema.safeParse({ ...run, sources: collectRetrievedResearch(searchCandidate(), "web").sources }).success, false);
  assert.equal(researchStateSchema.safeParse({ runs: [run], saved: [] }).success, true);
  assert.equal(researchStateSchema.safeParse({ runs: Array(7).fill(run), saved: [] }).success, false);
});

async function mockGemini<T>(reply: (body: Record<string, unknown>, index: number) => Response,
  run: (requests: Record<string, unknown>[]) => Promise<T>) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const requests: Record<string, unknown>[] = [];
  process.env.GEMINI_API_KEY = "test-key-never-sent";
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    assert.ok(request.url.startsWith("https://generativelanguage.googleapis.com/"), "Only the provider may retrieve pages; no application-side remote fetch");
    const body = await request.json() as Record<string, unknown>;
    requests.push(body);
    return reply(body, requests.length - 1);
  };
  try { return await run(requests); }
  finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
}
const modelResponse = (value: unknown) => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] });

test("hard deadline aborts a hanging provider and still rejects when the provider ignores abort", async () => {
  const state: { signal?: AbortSignal } = {};
  await assert.rejects(withResearchDeadline((incoming) => {
    state.signal = incoming;
    return new Promise(() => {});
  }, 10), (error) => error instanceof ApiError && error.code === "RESEARCH_TIMEOUT");
  assert.equal(state.signal?.aborted, true);
  assert.equal(await withResearchDeadline(async () => "ready", 100), "ready");
});

test("live research uses two passes, preserves source provenance and selects tools by mode", async () => {
  for (const mode of ["web", "hackathons", "urls"] as const) {
    await mockGemini((_, index) => index === 0
      ? Response.json({ candidates: [searchCandidate()] }) : modelResponse(extraction), async (requests) => {
      const run = await researchLive({ ...input, mode, urls: mode === "urls" ? [sourceUrl] : [] });
      researchRunSchema.parse(run);
      assert.equal(requests.length, 2);
      assert.equal(run.source, "live");
      assert.equal(run.sources[0].url, sourceUrl);
      assert.deepEqual(run.findings[0].sourceIds, [run.sources[0].id]);
      const tools = JSON.stringify(requests[0].tools);
      assert.ok(tools.includes("urlContext"));
      assert.equal(tools.includes("googleSearch"), mode !== "urls");
      assert.equal(requests[1].tools, undefined);
      assert.ok(JSON.stringify(requests[1]).includes(excerpt));
      assert.ok(JSON.stringify(requests[1]).includes("source-1"));
    });
  }
});

test("missing retrieval metadata stops before extraction and never becomes demo", async () => {
  await mockGemini(() => modelResponse({ answer: "I remember some projects." }), async (requests) => {
    await assert.rejects(researchLive(input), (error) => error instanceof ApiError && error.code === "RESEARCH_NO_SOURCES");
    assert.equal(requests.length, 1);
  });
});

test("unknown extraction citations get one constrained repair, then an explicit error", async () => {
  await mockGemini((_, index) => index === 0 ? Response.json({ candidates: [searchCandidate()] })
    : modelResponse({ ...extraction, findings: [{ ...extraction.findings[0], sourceIds: ["made-up-source"] }] }), async (requests) => {
    await assert.rejects(researchLive(input), (error) => error instanceof ApiError && error.code === "AI_INVALID_OUTPUT");
    assert.equal(requests.length, 3);
    assert.ok(JSON.stringify(requests[2]).includes("Never invent sources"));
  });
});

test("provider/tool failure stays actionable and does not silently replace live research", async () => {
  await mockGemini(() => Response.json({ error: { code: 400, message: "Tool unavailable", status: "INVALID_ARGUMENT" } }, { status: 400 }), async (requests) => {
    await assert.rejects(researchLive(input), (error) => error instanceof ApiError && error.code === "RESEARCH_TOOL_UNAVAILABLE");
    assert.equal(requests.length, 1);
  });
  await mockGemini(() => Response.json({ error: { code: 429, message: "You exceeded your current quota, please check your plan and billing details.", status: "RESOURCE_EXHAUSTED" } }, { status: 429 }), async (requests) => {
    await assert.rejects(researchLive(input), (error) => error instanceof ApiError && error.code === "RESEARCH_QUOTA_EXCEEDED" && error.message.includes("Google AI Studio"));
    assert.equal(requests.length, 1, "Quota exhaustion does not trigger costly retries");
  });
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try { await assert.rejects(researchLive(input), (error) => error instanceof ApiError && error.code === "AI_NOT_CONFIGURED"); }
  finally { if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey; }
});

const resultMarkup = (url = sourceUrl, title = "Pantry Exchange", snippet = "A project connecting nearby households with surplus pantry items.") =>
  `<div><a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(url)}&amp;rut=search-reference">${title}</a><a class="result__snippet">${snippet}</a></div>`;

test("public search parsing keeps real source links and snippets while discarding unsafe and scripted results", () => {
  const parsed = parsePublicSearchResults([
    `<script>${resultMarkup("https://example.com/forged")}</script>`,
    `<!-- ${resultMarkup("https://example.com/comment")} -->`,
    resultMarkup(sourceUrl, "Pantry &amp; Exchange", "A <b>project</b> connecting donors &#38; nearby households."),
    resultMarkup(sourceUrl), resultMarkup("http://127.0.0.1/private"),
    resultMarkup("https://example.com/?token=private"), resultMarkup("javascript:alert(1)"),
    resultMarkup("https://example.com/empty", "Empty", ""),
  ].join("\n"));
  assert.deepEqual(parsed, [{ title: "Pantry & Exchange", url: sourceUrl, snippet: "A project connecting donors & nearby households." }]);
  assert.throws(() => parsePublicSearchResults("x".repeat(512 * 1024 + 1)), (error) => error instanceof ApiError && error.code === "PUBLIC_SEARCH_TOO_LARGE");
});

async function withMockPublicFetch<T>(reply: (request: Request) => Response | Promise<Response>, run: () => Promise<T>) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => reply(new Request(input, init));
  try { return await run(); }
  finally { globalThis.fetch = original; }
}

test("public web fallback fetches only its fixed search origin and labels snippets as unextracted ideas", async () => {
  const requested: string[] = [];
  await withMockPublicFetch((request) => {
    requested.push(request.url);
    assert.equal(new URL(request.url).origin, "https://html.duckduckgo.com");
    assert.equal(request.redirect, "manual");
    return new Response(resultMarkup(), { headers: { "content-type": "text/html" } });
  }, async () => {
    const run = await researchPublicWeb({ ...input, mode: "urls", urls: [sourceUrl] }, "Gemini's research quota is exhausted");
    assert.equal(requested.length, 1);
    assert.ok(new URL(requested[0]).searchParams.get("q")?.includes("site:devpost.com/software/pantry-exchange"));
    assert.equal(run.engine, "public-web");
    assert.equal(run.source, "live");
    assert.equal(run.sources[0].url, sourceUrl);
    assert.equal(run.sources[0].access, "search");
    assert.equal(run.findings[0].kind, "idea");
    assert.equal(run.findings[0].feature, "A project connecting nearby households with surplus pantry items.");
    assert.ok(run.findings[0].howItWorks.includes("not extracted"));
    assert.ok(run.summary.includes("DuckDuckGo"));
    assert.ok(run.limitations.some((item) => item.includes("did not scrape")));
    assert.equal(researchRunSchema.safeParse({ ...run, sources: [{ ...run.sources[0], access: "retrieved" }] }).success, false);
  });
});

test("quota failure automatically falls back to actual search results instead of demo output", async () => {
  const key = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key-never-sent";
  const origins: string[] = [];
  try {
    await withMockPublicFetch((request) => {
      const origin = new URL(request.url).origin;
      origins.push(origin);
      if (origin === "https://generativelanguage.googleapis.com")
        return Response.json({ error: { code: 429, message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" } }, { status: 429 });
      assert.equal(origin, "https://html.duckduckgo.com");
      return new Response(resultMarkup());
    }, async () => {
      const run = await researchWithFallback(input);
      assert.equal(run.source, "live");
      assert.equal(run.engine, "public-web");
      assert.ok(run.summary.includes("quota is exhausted"));
      assert.deepEqual(origins, ["https://generativelanguage.googleapis.com", "https://html.duckduckgo.com"]);
    });
  } finally {
    if (key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = key;
  }
});

test("public search fails clearly on challenges, oversized bodies and unrelated URL results", async () => {
  for (const response of [
    new Response("Redirect", { status: 302, headers: { location: "http://127.0.0.1/private" } }),
    new Response("Browser verification", { status: 202 }),
    new Response("x".repeat(512 * 1024 + 1)),
    new Response('<form id="challenge-form">Verify</form>'),
    new Response(resultMarkup("https://unrelated.example.com/project")),
  ]) {
    await withMockPublicFetch(() => response.clone(), async () => {
      await assert.rejects(researchPublicWeb({ ...input, mode: "urls", urls: [sourceUrl] }),
        (error) => error instanceof ApiError && error.status === 502);
    });
  }
});
