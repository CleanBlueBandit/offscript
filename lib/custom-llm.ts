import { ApiError } from "./validation";
import { describeError, logDebug, logError, logInfo, preview } from "./gemini-log";

/**
 * Optional non-Gemini backend: any endpoint that accepts POST {"prompt": "..."} and returns
 * the model's answer as JSON or text (e.g. a Lovable "ask" function).
 * Enabled by setting LLM_ENDPOINT_URL. Optional LLM_ENDPOINT_TOKEN is sent as a Bearer token.
 */
export function customEndpointUrl(): string | undefined {
  return process.env.LLM_ENDPOINT_URL?.trim() || undefined;
}

const TEXT_KEYS = ["data", "text", "answer", "response", "output", "result", "content", "message", "completion", "reply"];

/** Find the model's text in whatever shape the endpoint returns. */
export function extractText(data: unknown, depth = 0): string | undefined {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object" || depth > 3) return undefined;
  const record = data as Record<string, unknown>;
  for (const key of TEXT_KEYS) {
    const found = extractText(record[key], depth + 1);
    if (found) return found;
  }
  const choice = (record.choices as Array<Record<string, unknown>> | undefined)?.[0];
  return choice ? extractText(choice.message ?? choice.text, depth + 1) : undefined;
}

/** Models often wrap JSON in code fences or add a sentence around it. */
export function toJsonText(raw: string): string {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (text.startsWith("{") || text.startsWith("[")) return text;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

/** Gemini's Schema uses upper-case type names; plain JSON Schema uses lower-case. */
export function schemaToJsonSchemaText(schema: unknown): string {
  return JSON.stringify(schema, (key, value) =>
    key === "type" && typeof value === "string" ? value.toLowerCase() : value,
  );
}

export async function callCustomEndpoint(
  id: string,
  url: string,
  prompt: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  const startedAt = Date.now();
  const timeout = AbortSignal.timeout(55_000);
  const signal = abortSignal && "any" in AbortSignal ? AbortSignal.any([abortSignal, timeout]) : timeout;
  const token = process.env.LLM_ENDPOINT_TOKEN?.trim();
  logInfo(id, "custom endpoint request", { host: new URL(url).host, promptChars: prompt.length });
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ prompt }),
      signal,
    });
  } catch (error) {
    logError(id, `custom endpoint unreachable after ${Date.now() - startedAt}ms`, error);
    const timedOut = error instanceof Error && /timeout|timed out|abort/i.test(`${error.name} ${error.message}`);
    throw new ApiError(
      timedOut ? 504 : 502,
      timedOut ? "The AI endpoint took too long. Retry this step or select Demo mode." : "The AI endpoint could not be reached. Retry or select Demo mode.",
      timedOut ? "AI_TIMEOUT" : "AI_PROVIDER_ERROR",
    );
  }
  const body = await res.text();
  logInfo(id, `custom endpoint HTTP ${res.status} in ${Date.now() - startedAt}ms`, { bodyChars: body.length });
  logDebug(id, "custom endpoint body", { body: preview(body, 1500) });
  if (!res.ok) {
    logError(id, `custom endpoint returned HTTP ${res.status}`, undefined, { body: preview(body, 800) });
    if (res.status === 429) throw new ApiError(429, "The AI endpoint is rate-limiting this workshop. Wait briefly and try again, or select Demo mode.", "AI_RATE_LIMITED");
    if (res.status === 401 || res.status === 403) throw new ApiError(503, "The AI endpoint rejected the request. Check LLM_ENDPOINT_TOKEN, or select Demo mode.", "AI_ACCESS_DENIED");
    throw new ApiError(502, "The AI endpoint could not complete this step. Retry or select Demo mode; your workshop is preserved.", "AI_PROVIDER_ERROR");
  }
  let data: unknown = body;
  try { data = JSON.parse(body); } catch { /* plain-text reply */ }
  const text = extractText(data);
  if (text) return text;
  // Some endpoints return the model's JSON object directly.
  if (data && typeof data === "object" && !("error" in (data as object))) return JSON.stringify(data);
  logError(id, "could not find model text in endpoint response", undefined, { shape: preview(describeError(data), 300) });
  throw new ApiError(502, "The AI endpoint returned an unexpected response shape.", "AI_PROVIDER_ERROR");
}
