import { logInfo, logWarn } from "./gemini-log";
import { ApiError } from "./validation";
import {
  normalizePublicUrl,
  researchRequestSchema,
  researchRunSchema,
  type ResearchRequest,
} from "./research-validation";
import type { ResearchMode, ResearchRun, ResearchSource } from "./research-types";

function sourceKind(url: string, title: string, mode: ResearchMode): ResearchSource["kind"] {
  if (/hackathon|devpost|hackster|hackerearth|dorahacks/iu.test(`${url} ${title}`)) return "hackathon";
  if (/\/blog\/|\/news\/|\/articles?\//iu.test(url)) return "article";
  return mode === "hackathons" ? "hackathon" : "website";
}

/** Enforce a wall-clock deadline even if a provider fetch ignores its own timeout. */
export async function withResearchDeadline<T>(task: (signal: AbortSignal) => Promise<T>, milliseconds: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ApiError(504, "Research took too long. Try fewer pages or a narrower query; your saved research is preserved.", "RESEARCH_TIMEOUT"));
      controller.abort();
    }, milliseconds);
  });
  try { return await Promise.race([task(controller.signal), deadline]); }
  finally { clearTimeout(timer); }
}

type PublicSearchResult = { title: string; url: string; snippet: string };
const PUBLIC_SEARCH_ENDPOINT = "https://html.duckduckgo.com/html/";
const MAX_SEARCH_BYTES = 512 * 1024;

function plainSearchText(value: string): string {
  const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu, " ")
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<[^>]*>/gu, " ")
    .replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/giu, (match, entity: string) => {
      if (!entity.startsWith("#")) return entities[entity.toLowerCase()] || match;
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : " ";
    })
    .replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim();
}

/** Read only bounded search-result markup. Never evaluate scripts or fetch linked pages. */
export function parsePublicSearchResults(html: string): PublicSearchResult[] {
  if (html.length > MAX_SEARCH_BYTES) throw new ApiError(502, "The public search response was too large. Try a narrower query.", "PUBLIC_SEARCH_TOO_LARGE");
  html = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu, " ").replace(/<!--[\s\S]*?-->/gu, " ");
  const anchors = [...html.matchAll(/<a\b([^>]*\bclass=["'][^"']*\bresult__a\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/giu)].slice(0, 30);
  const results: PublicSearchResult[] = [];
  for (let index = 0; index < anchors.length; index++) {
    const [full, attributes, rawTitle] = anchors[index];
    const href = attributes.match(/\bhref=["']([^"']+)["']/iu)?.[1];
    if (!href) continue;
    let url: string | null = null;
    try {
      const link = new URL(plainSearchText(href), PUBLIC_SEARCH_ENDPOINT);
      const destination = ["duckduckgo.com", "html.duckduckgo.com"].includes(link.hostname) && link.pathname === "/l/"
        ? link.searchParams.get("uddg") : link.toString();
      url = destination ? normalizePublicUrl(destination) : null;
    } catch { continue; }
    if (!url || /(^|\.)duckduckgo\.com$/iu.test(new URL(url).hostname)) continue;
    const start = anchors[index].index! + full.length;
    const section = html.slice(start, anchors[index + 1]?.index ?? html.length);
    const rawSnippet = section.match(/<(?:a|div|span)\b[^>]*\bclass=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/iu)?.[1];
    const title = plainSearchText(rawTitle).slice(0, 120);
    const snippet = plainSearchText(rawSnippet || "").slice(0, 500);
    if (title.length < 3 || snippet.length < 20 || results.some((item) => item.url === url)) continue;
    results.push({ title, url, snippet });
  }
  return results;
}

async function publicSearch(query: string, signal: AbortSignal): Promise<PublicSearchResult[]> {
  // Only this fixed origin is fetched. User URLs are search terms, never fetch targets.
  const url = new URL(PUBLIC_SEARCH_ENDPOINT);
  url.searchParams.set("q", query.slice(0, 1000));
  const response = await fetch(url, {
    signal, redirect: "manual",
    headers: { Accept: "text/html", "Accept-Language": "en-US,en;q=0.8", "User-Agent": "Offscript/0.1 (public project discovery)" },
  });
  // Workerd supports manual/follow, not error. Never follow even a provider redirect.
  if (response.status >= 300 && response.status < 400)
    throw new ApiError(502, "Public search redirected to an unsupported endpoint. Try again later.", "PUBLIC_SEARCH_UNAVAILABLE");
  if (!response.ok || response.status === 202) {
    logWarn("public-search", `DuckDuckGo returned HTTP ${response.status}`, {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      retryAfter: response.headers.get("retry-after"),
      queryChars: query.length,
    });
    throw new ApiError(502, "Public web search is temporarily unavailable. Try again shortly.", "PUBLIC_SEARCH_UNAVAILABLE");
  }
  if (Number(response.headers.get("content-length")) > MAX_SEARCH_BYTES)
    throw new ApiError(502, "The public search response was too large. Try a narrower query.", "PUBLIC_SEARCH_TOO_LARGE");
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError(502, "Public search returned no readable results.", "PUBLIC_SEARCH_UNAVAILABLE");
  const decoder = new TextDecoder();
  let html = "", bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_SEARCH_BYTES) {
        void reader.cancel().catch(() => {});
        throw new ApiError(502, "The public search response was too large. Try a narrower query.", "PUBLIC_SEARCH_TOO_LARGE");
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
  } finally { reader.releaseLock(); }
  if (/id=["']challenge-form|Unfortunately, bots use DuckDuckGo/iu.test(html)) {
    logWarn("public-search", "DuckDuckGo served a bot challenge page", { htmlChars: html.length });
    throw new ApiError(502, "Public web search requested a browser verification. Try again later.", "PUBLIC_SEARCH_UNAVAILABLE");
  }
  return parsePublicSearchResults(html);
}

export async function researchPublicWeb(request: ResearchRequest, reason = "Public web search is used for live research"): Promise<ResearchRun> {
  const input = researchRequestSchema.parse(request);
  const queries = input.mode === "urls"
    ? input.urls.map((value) => { const url = new URL(value); return `site:${url.hostname}${url.pathname === "/" ? "" : url.pathname} ${input.query}`.trim(); })
    : input.mode === "hackathons"
      ? [`${input.query} site:devpost.com/software`, `${input.query} hackathon projects`]
      : [input.query];
  let batches: PromiseSettledResult<PublicSearchResult[]>[];
  try {
    batches = await withResearchDeadline((signal) => Promise.allSettled(queries.map((query) => publicSearch(query, signal))), 20_000);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Public web search could not connect. Try again shortly; your saved research is preserved.", "PUBLIC_SEARCH_UNAVAILABLE");
  }
  const results: PublicSearchResult[] = [];
  if (batches.every((batch) => batch.status === "rejected")) {
    const failure = (batches[0] as PromiseRejectedResult).reason;
    if (failure instanceof ApiError) throw failure;
    throw new ApiError(502, "Public web search could not connect from this server. Try again shortly; your saved research is preserved.", "PUBLIC_SEARCH_UNAVAILABLE");
  }
  for (const batch of batches) {
    if (batch.status !== "fulfilled") continue;
    for (const item of batch.value) {
      if (results.some((result) => result.url === item.url)) continue;
      const target = new URL(item.url);
      if (input.mode === "urls" && !input.urls.some((value) => {
        const requested = new URL(value);
        return target.hostname === requested.hostname && target.pathname.startsWith(requested.pathname);
      })) continue;
      // A platform's home page is not a past project. Keep actual project/event entries.
      if (input.mode === "hackathons" && ["devpost.com", "www.devpost.com"].includes(target.hostname) && !target.pathname.startsWith("/software/")) continue;
      results.push(item);
    }
  }
  if (input.mode === "hackathons") {
    const projectScore = (item: PublicSearchResult) => {
      const url = new URL(item.url);
      if (url.hostname.endsWith("devpost.com") && url.pathname.startsWith("/software/")) return 4;
      if (url.hostname === "github.com" && !/^\/(topics|search|collections|sponsors)\b/u.test(url.pathname) && url.pathname.split("/").filter(Boolean).length >= 2) return 3;
      if (/project|prototype|built|developed/iu.test(`${item.title} ${item.snippet}`)) return 2;
      return 1;
    };
    results.sort((a, b) => projectScore(b) - projectScore(a));
  }
  results.splice(6);
  if (!results.length) throw new ApiError(502,
    input.mode === "urls" ? "No indexed results matched those public pages. Try the site's main URL or search the web for its product name."
      : "Public web search returned no readable matches. Try a shorter, more specific topic.", "PUBLIC_SEARCH_NO_RESULTS");
  const sources: ResearchSource[] = results.map((result, index) => ({
    id: `source-${index + 1}`, title: result.title, url: result.url,
    kind: sourceKind(result.url, result.title, input.mode), access: "search", summary: result.snippet,
  }));
  return researchRunSchema.parse({
    id: crypto.randomUUID(), query: input.query, mode: input.mode, createdAt: Date.now(),
    source: "live", engine: "public-web", sources,
    summary: `Found ${results.length} real public-web ${results.length === 1 ? "idea" : "ideas"} through DuckDuckGo search. ${reason}. These are source titles and search snippets; open the original pages to investigate each idea.`,
    findings: results.map((result, index) => ({
      id: crypto.randomUUID(), title: result.title, kind: "idea", sourceIds: [sources[index].id],
      feature: result.snippet,
      problem: "Open the original source to establish the specific user problem.",
      howItWorks: "The full mechanism was not extracted. Review the linked project or website.",
      adaptation: "Use this source as a starting point. Inspect the original, identify one useful feature, and check it against your team's problem before adapting it.",
    })),
    limitations: [
      "Search results supplied by DuckDuckGo. Titles and snippets can be incomplete or outdated; linked pages were not fetched by Offscript.",
      "AI feature extraction is not applied to public web results. No problem, mechanism, originality, winning status or feasibility was inferred from these snippets.",
      ...(input.mode === "urls" ? ["Specific-page mode used an indexed search restricted to the supplied page paths; it did not scrape those pages directly."] : []),
    ],
    searchQueries: queries.map((query) => query.slice(0, 500)),
  });
}

/** Live research uses public web search only (source-linked leads, no AI extraction). */
export async function researchWithFallback(request: ResearchRequest): Promise<ResearchRun> {
  logInfo("research", "using public web search");
  return researchPublicWeb(request, "Public web search is used for live research");
}

export function researchDemo(request: ResearchRequest): ResearchRun {
  const input = researchRequestSchema.parse(request);
  return researchRunSchema.parse({
    id: crypto.randomUUID(), query: input.query, mode: input.mode, createdAt: Date.now(),
    source: "demo", sources: [],
    summary: "Illustrative research examples. No websites were searched or read; use Live AI for source-linked findings.",
    findings: [
      {
        id: crypto.randomUUID(), title: "Example: preserve interrupted work", kind: "pattern",
        problem: "Illustrative problem: someone returns to a task and has to reconstruct where they stopped.",
        feature: "Illustrative feature: a small resumption card remembers the last meaningful action.",
        howItWorks: "A local draft stores the current step and the next action, then offers a one-click resume. This is a hypothetical pattern, not a scraped product feature.",
        adaptation: `Proposed exercise for ${input.query.slice(0, 180) || "your chosen pages"}: find a moment of interruption and prototype a resumable step. Check a real source and interview a user before adopting it.`,
        sourceIds: [],
      },
      {
        id: crypto.randomUUID(), title: "Example: preview a reversible decision", kind: "feature",
        problem: "Illustrative problem: people hesitate when a choice has consequences they cannot inspect.",
        feature: "Illustrative feature: show one concrete before-and-after preview with an undo action.",
        howItWorks: "A user changes one input, sees the immediate consequence, and can restore the previous state. No real product or hackathon project was retrieved.",
        adaptation: "Proposed exercise: choose one decision in your problem and test whether a small preview helps a prospective user make it. Keep this separate from evidence until researched.",
        sourceIds: [],
      },
    ],
    limitations: ["Demo only: these patterns are fictional teaching examples, not evidence from websites or past hackathons."],
  });
}
