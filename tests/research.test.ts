import assert from "node:assert/strict";
import test from "node:test";
import { parsePublicSearchResults, researchDemo, researchPublicWeb, researchWithFallback, withResearchDeadline } from "../lib/research";
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

test("extraction and saved evidence reject invented, missing and duplicate citation IDs", () => {
  const validator = researchExtractionSchema(["source-1"]);
  assert.equal(validator.safeParse(extraction).success, true);
  for (const sourceIds of [[], ["invented"], ["source-1", "source-1"]])
    assert.equal(validator.safeParse({ ...extraction, findings: [{ ...extraction.findings[0], sourceIds }] }).success, false);
  const evidence = {
    ...extraction.findings[0], id: "finding-1", collectedAt: Date.now(),
    sources: [{ id: "source-1", title: "Pantry Exchange hackathon project", url: sourceUrl, kind: "hackathon" as const, access: "retrieved" as const }],
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
  assert.equal(researchStateSchema.safeParse({ runs: [run], saved: [] }).success, true);
  assert.equal(researchStateSchema.safeParse({ runs: Array(7).fill(run), saved: [] }).success, false);
});

test("hard deadline aborts a hanging provider and still rejects when the provider ignores abort", async () => {
  const state: { signal?: AbortSignal } = {};
  await assert.rejects(withResearchDeadline((incoming) => {
    state.signal = incoming;
    return new Promise(() => {});
  }, 10), (error) => error instanceof ApiError && error.code === "RESEARCH_TIMEOUT");
  assert.equal(state.signal?.aborted, true);
  assert.equal(await withResearchDeadline(async () => "ready", 100), "ready");
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

test("live research goes straight to public web search without calling any model provider", async () => {
  const origins: string[] = [];
  await withMockPublicFetch((request) => {
    origins.push(new URL(request.url).origin);
    return new Response(resultMarkup());
  }, async () => {
    const run = await researchWithFallback(input);
    assert.equal(run.source, "live");
    assert.equal(run.engine, "public-web");
    assert.deepEqual(origins, ["https://html.duckduckgo.com"]);
  });
});
