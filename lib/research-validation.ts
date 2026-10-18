import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
export const researchModeSchema = z.enum(["web", "hackathons", "urls"]);

/** Research is a public-page workflow. No credentials, local targets or arbitrary ports. */
export function normalizePublicUrl(value: string): string | null {
  if (value.length > 2048 || /[\u0000-\u0020\u007f]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (!/^https?:$/u.test(url.protocol) || url.username || url.password || url.port)
      return null;
    const host = url.hostname.toLowerCase().replace(/\.$/u, "");
    // Reject all IP literals, including URL-normalized decimal/hex IPv4 forms.
    if (!host.includes(".") || host.includes(":") || /^[\d.]+$/u.test(host))
      return null;
    if (!/^[a-z\d.-]+$/u.test(host) || host.split(".").some((part) => !part))
      return null;
    const blocked = [
      "localhost", "local", "internal", "intranet", "lan", "home", "corp",
      "test", "invalid", "example", "onion", "localdomain",
    ];
    if (blocked.some((suffix) => host === suffix || host.endsWith(`.${suffix}`)))
      return null;
    if (/\b(?:localhost|127[.-]0[.-]0[.-]1)\b/u.test(host)) return null;
    // Common DNS-to-IP services can resolve an apparently public hostname locally.
    if (["nip.io", "sslip.io", "localtest.me", "lvh.me"].some((suffix) =>
      host === suffix || host.endsWith(`.${suffix}`))) return null;
    const sensitive = (key: string) => /(?:token|apikey|secret|password|passwd|credential|authorization|session|signature)$|^(?:key|auth|sig)$/u
      .test(key.replace(/[^a-z]/giu, "").toLowerCase());
    if ([...url.searchParams.keys()].some(sensitive)) return null;
    if ([...new URLSearchParams(url.hash.slice(1)).keys()].some(sensitive)) return null;
    url.hostname = host;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export const publicResearchUrlSchema = text(2048)
  .refine((value) => normalizePublicUrl(value) !== null,
    "Use a public HTTP(S) website URL without a login, access token, IP address or custom port.")
  .transform((value) => normalizePublicUrl(value)!);

export const researchRequestSchema = z.object({
  query: text(1200).default(""),
  mode: researchModeSchema.default("web"),
  urls: z.array(publicResearchUrlSchema).max(5).default([]),
  demo: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.mode === "urls" && value.urls.length === 0)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["urls"], message: "Add at least one public page to inspect." });
  if (value.mode !== "urls" && value.query.length < 3)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["query"], message: "Describe what to research in at least 3 characters." });
  if (new Set(value.urls).size !== value.urls.length)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["urls"], message: "Each page URL must be different." });
  // URLs embedded in the query must pass the same checks as the dedicated input.
  const embedded = value.query.match(/https?:\/\/[^\s<>"']+/giu) || [];
  if (embedded.some((url) => !normalizePublicUrl(url.replace(/[),.;]+$/u, ""))))
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["query"], message: "The query contains a private or credential-bearing URL. Use public pages only." });
  if (new Set([...embedded, ...value.urls]).size > 5)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["urls"], message: "Research at most five explicit URLs at a time." });
});

export const researchSourceSchema = z.object({
  id: text(100).min(1),
  title: text(220).min(1),
  url: publicResearchUrlSchema,
  kind: z.enum(["website", "hackathon", "article"]),
  access: z.enum(["retrieved", "search"]),
  summary: text(600).optional(),
});

export const researchFindingSchema = z.object({
  id: text(100).min(1),
  title: text(120).min(1),
  problem: text(500).min(1),
  feature: text(500).min(1),
  howItWorks: text(700).min(1),
  adaptation: text(700).min(1),
  sourceIds: z.array(text(100).min(1)).max(6),
  kind: z.enum(["feature", "problem", "pattern", "idea"]),
});

function referencesMatch(sourceIds: string[], sources: { id: string }[]) {
  const ids = new Set(sources.map((source) => source.id));
  return ids.size === sources.length && new Set(sourceIds).size === sourceIds.length &&
    sourceIds.every((id) => ids.has(id));
}

export const researchEvidenceSchema = researchFindingSchema.extend({
  sources: z.array(researchSourceSchema).max(6),
  collectedAt: z.number().int().nonnegative(),
}).refine((value) => referencesMatch(value.sourceIds, value.sources) &&
  value.sources.length === value.sourceIds.length,
"Every saved source must match an evidence citation exactly once.");

export const researchRunSchema = z.object({
  id: text(100).min(1),
  query: text(1200),
  mode: researchModeSchema,
  createdAt: z.number().int().nonnegative(),
  summary: text(1200).min(1),
  sources: z.array(researchSourceSchema).max(12),
  findings: z.array(researchFindingSchema).min(1).max(6),
  limitations: z.array(text(500).min(1)).max(8),
  searchQueries: z.array(text(500)).max(10).optional(),
  searchEntryPoint: z.string().max(12000).optional(),
  source: z.enum(["live", "demo"]),
  engine: z.enum(["gemini", "public-web"]).optional(),
}).superRefine((value, context) => {
  if (new Set(value.sources.map((source) => source.id)).size !== value.sources.length ||
      new Set(value.findings.map((finding) => finding.id)).size !== value.findings.length)
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Research source and finding IDs must be unique." });
  value.findings.forEach((finding, index) => {
    if (!referencesMatch(finding.sourceIds, value.sources) ||
        (value.source === "live" && finding.sourceIds.length === 0))
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["findings", index, "sourceIds"], message: "Live findings must cite sources retrieved in this run." });
  });
  if (value.source === "demo" && (value.sources.length || value.searchEntryPoint || value.searchQueries?.length))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Illustrative demo research must not impersonate retrieved sources." });
  if (value.engine === "public-web" && (value.source !== "live" || value.sources.some((source) => source.access !== "search")))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Public web discoveries must remain labeled search results, not full-page extractions." });
});

export const researchStateSchema = z.object({
  runs: z.array(researchRunSchema).max(6).default([]),
  saved: z.array(researchEvidenceSchema).max(12).default([]),
});

export const researchExtractionSchema = (sourceIds: string[]) => z.object({
  summary: text(1200).min(1),
  findings: z.array(researchFindingSchema.omit({ id: true })).min(1).max(6),
  limitations: z.array(text(500).min(1)).max(5),
}).superRefine((value, context) => {
  value.findings.forEach((finding, index) => {
    if (!finding.sourceIds.length || new Set(finding.sourceIds).size !== finding.sourceIds.length ||
        finding.sourceIds.some((id) => !sourceIds.includes(id)))
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["findings", index, "sourceIds"], message: "Cite at least one supplied evidence source ID. Never invent sources." });
  });
});

export type ResearchRequest = z.infer<typeof researchRequestSchema>;
