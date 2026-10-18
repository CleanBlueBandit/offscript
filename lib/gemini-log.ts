/**
 * Server-side Gemini diagnostics. Uses console only (works in Node and Workers).
 *
 * Always logged: one line per call (start, success/failure, duration), full provider
 * error details, validation failures, and non-STOP finish reasons.
 * With GEMINI_DEBUG=1 also logged: request/response previews (may contain user workshop text).
 *
 * The API key is never logged; any occurrence in a message is redacted.
 */

export function debugEnabled(): boolean {
  const value = process.env.GEMINI_DEBUG?.trim().toLowerCase();
  return value === "1" || value === "true";
}

let counter = 0;
export function nextCallId(label: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${label}#${counter}`;
}

function redact(text: string): string {
  let out = text;
  for (const key of [process.env.GEMINI_API_KEY?.trim(), process.env.LLM_ENDPOINT_TOKEN?.trim()])
    if (key) out = out.split(key).join("[REDACTED]");
  // Catch keys passed in URLs or echoed by the provider.
  return out.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]");
}

export function preview(value: unknown, max = 600): string {
  let text: string;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  text = redact(text ?? "");
  return text.length > max ? `${text.slice(0, max)}… [+${text.length - max} chars]` : text;
}

/** Pull every useful field out of an unknown thrown value (the SDK's ApiError carries `status`). */
export function describeError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") return { value: preview(String(error)) };
  const e = error as Record<string, unknown> & { cause?: unknown };
  const out: Record<string, unknown> = {
    name: e.name,
    status: e.status,
    code: e.code,
    message: preview(e.message ?? "", 1500),
  };
  if (e.details) out.details = preview(e.details, 1500);
  if (e.cause) {
    const c = e.cause as Record<string, unknown>;
    out.cause = {
      name: c?.name,
      code: c?.code,
      message: preview(c?.message ?? String(e.cause), 500),
    };
  }
  return out;
}

export function logInfo(id: string, message: string, data?: Record<string, unknown>) {
  console.info(`[Offscript][gemini] ${id} ${message}`, data ? redact(JSON.stringify(data)) : "");
}

export function logWarn(id: string, message: string, data?: Record<string, unknown>) {
  console.warn(`[Offscript][gemini] ${id} ${message}`, data ? redact(JSON.stringify(data)) : "");
}

export function logError(id: string, message: string, error?: unknown, data?: Record<string, unknown>) {
  console.error(
    `[Offscript][gemini] ${id} ${message}`,
    redact(JSON.stringify({ ...data, ...(error === undefined ? {} : { error: describeError(error) }) })),
  );
}

export function logDebug(id: string, message: string, data?: Record<string, unknown>) {
  if (debugEnabled()) logInfo(id, `(debug) ${message}`, data);
}

/** Summarize the parts of a GenerateContentResponse that explain empty or blocked output. */
export function describeResponse(response: unknown): Record<string, unknown> {
  const r = response as {
    candidates?: Array<{ finishReason?: string; finishMessage?: string; safetyRatings?: unknown }>;
    promptFeedback?: unknown;
    usageMetadata?: unknown;
    modelVersion?: string;
  };
  const candidate = r?.candidates?.[0];
  return {
    modelVersion: r?.modelVersion,
    candidates: r?.candidates?.length ?? 0,
    finishReason: candidate?.finishReason,
    finishMessage: candidate?.finishMessage,
    safetyRatings: candidate?.safetyRatings,
    promptFeedback: r?.promptFeedback,
    usage: r?.usageMetadata,
  };
}
