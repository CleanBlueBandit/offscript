import assert from "node:assert/strict";
import test from "node:test";
import { researchDemo, researchLive, withResearchDeadline, type ModelCall, type ModelReply } from "../lib/research";
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

const redirect = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc123";
const grounding = {
  webSearchQueries: ["pantry surplus sharing hackathon"],
  searchEntryPoint: { renderedContent: "<div>Google Search suggestions</div>" },
  groundingChunks: [
    { web: { uri: redirect, title: "devpost.com" } },
    { web: { uri: "http://127.0.0.1/private", title: "local" } },
    { web: { uri: "https://example.com/?token=secret", title: "leaky" } },
    { web: { uri: `${redirect}-2`, title: "unsupported.org" } },
  ],
  groundingSupports: [{ segment: { text: excerpt }, groundingChunkIndices: [0, 1, 2] }],
};

/** Records every call and replies from a script, so no test can reach a real provider. */
function scripted(replies: Array<ModelReply | Error>) {
  const calls: ModelCall[] = [];
  const runner = async (call: ModelCall) => {
    calls.push(call);
    const next = replies.shift();
    if (!next) throw new Error("unexpected extra model call");
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, runner };
}
const json = (value: unknown): ModelReply => ({ text: JSON.stringify(value) });

test("grounded research keeps only public cited sources, labels them honestly and attaches Google attribution", async () => {
  const { calls, runner } = scripted([{ text: "Notes about Pantry Exchange.", grounding }, json({ ...extraction, findings: [{ ...extraction.findings[0], sourceIds: ["source-1"] }] })]);
  const run = await researchLive(input, runner);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].search && !calls[0].search.urlContext, "step 1 is search-grounded");
  assert.equal(calls[1].search, undefined, "step 2 is ungrounded structured extraction");
  assert.equal(run.source, "live");
  assert.equal(run.engine, "gemini");
  assert.deepEqual(run.sources.map((source) => source.id), ["source-1", "source-2"]);
  assert.equal(run.sources[0].access, "retrieved", "a source that backs a sentence counts as reviewed");
  assert.equal(run.sources[0].kind, "hackathon");
  assert.equal(run.sources[0].summary, excerpt);
  assert.equal(run.sources[1].access, "search", "a source that backs nothing stays search-only");
  assert.deepEqual(run.searchQueries, ["pantry surplus sharing hackathon"]);
  assert.equal(run.searchEntryPoint, "<div>Google Search suggestions</div>");
  assert.ok(run.limitations.some((item) => item.includes("did not open these pages")));
  assert.equal(researchRunSchema.safeParse(run).success, true);
});

test("URL mode turns on URL context and reports pages Gemini could not read", async () => {
  const { calls, runner } = scripted([
    { text: "Notes.", grounding, urls: [{ retrievedUrl: sourceUrl, urlRetrievalStatus: "URL_RETRIEVAL_STATUS_ERROR" }] },
    json(extraction),
  ]);
  const run = await researchLive({ ...input, mode: "urls", urls: [sourceUrl] }, runner);
  assert.equal(calls[0].search?.urlContext, true);
  assert.ok(calls[0].prompt.includes(sourceUrl));
  assert.ok(run.limitations.some((item) => item.includes("could not read")));
});

test("research fails clearly instead of presenting uncited or ungrounded text", async () => {
  for (const reply of [
    { text: "Plain answer with no grounding." },
    { text: "Notes", grounding: { groundingChunks: grounding.groundingChunks } },
    { text: "Notes", grounding: { ...grounding, groundingChunks: [{ web: { uri: "http://127.0.0.1/x", title: "x" } }] } },
  ]) await assert.rejects(researchLive(input, scripted([reply]).runner),
    (error) => error instanceof ApiError && error.code === "RESEARCH_NO_SOURCES");
});

test("extraction retries once with the validation error, then gives up rather than inventing citations", async () => {
  const invented = json({ ...extraction, findings: [{ ...extraction.findings[0], sourceIds: ["source-99"] }] });
  const retry = scripted([{ text: "Notes", grounding }, invented, json(extraction)]);
  const run = await researchLive(input, retry.runner);
  assert.equal(retry.calls.length, 3);
  assert.ok(retry.calls[2].prompt.includes("previous reply was rejected"));
  assert.deepEqual(run.findings[0].sourceIds, ["source-1"]);
  await assert.rejects(researchLive(input, scripted([{ text: "Notes", grounding }, invented, invented]).runner),
    (error) => error instanceof ApiError && error.code === "RESEARCH_EXTRACTION_FAILED");
});

test("provider failures map to clear, key-free errors", async () => {
  for (const [statusCode, status, code] of [[429, 429, "RESEARCH_RATE_LIMITED"], [403, 503, "RESEARCH_ACCESS_DENIED"], [500, 502, "RESEARCH_PROVIDER_ERROR"]] as const)
    await assert.rejects(researchLive(input, scripted([Object.assign(new Error("secret-key-123 rejected"), { statusCode })]).runner),
      (error) => error instanceof ApiError && error.status === status && error.code === code && !error.message.includes("secret-key-123"));
});

test("live research without a server credential fails explicitly and never falls back to another search engine", async () => {
  const saved = { ...process.env };
  for (const key of ["AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN", "VERCEL", "GOOGLE_GENERATIVE_AI_API_KEY"]) delete process.env[key];
  const original = globalThis.fetch;
  let fetched = 0;
  globalThis.fetch = async () => { fetched++; return new Response("{}"); };
  try {
    await assert.rejects(researchLive(input), (error) => error instanceof ApiError && error.code === "RESEARCH_NOT_CONFIGURED" && error.status === 503);
    assert.equal(fetched, 0);
  } finally { globalThis.fetch = original; Object.assign(process.env, saved); }
});
