import { z } from "zod";
import type { Perspective } from "./types";
import { researchEvidenceSchema } from "./research-validation";

export const categorySchema = z.enum([
  "Physical & Kinetic",
  "Biological & Natural",
  "Economic & Game Theory",
  "Systems & Chaos",
  "Sensory & Human",
  "Historical & Analog",
]);
const text = (max: number) => z.string().trim().max(max);
export const perspectiveSchema = z.object({
  id: text(100).min(1),
  name: text(100).min(1),
  category: categorySchema,
  axiom: text(1000).min(1),
  operator: text(1000).min(1),
  forbiddenWords: z.array(text(50).min(1)).max(30),
});
export const briefSchema = z.object({
  research: z.array(researchEvidenceSchema).max(12).optional(),
  challenge: text(3000).min(
    3,
    "Describe the challenge in at least 3 characters.",
  ),
  observations: text(3000).default(""),
  targetUser: text(1000).optional(),
  moment: text(2000).optional(),
  workaround: text(2000).optional(),
  ownIdeas: text(4000).optional(),
  constraints: text(2000).default(""),
  tracks: z.array(text(80).min(1)).max(10).default([]),
  judge: z.object({
    who: text(1500),
    avoid: text(2000),
    love: text(2000),
    winners: text(2500),
  }),
});
export const ingredientSchema = z.object({
  id: text(150).min(1),
  perspectiveId: text(100).min(1),
  perspectiveName: text(100).min(1),
  kind: z.enum(["provocation", "mechanic", "flip"]),
  text: text(400).min(1),
});
export const assessmentSchema = z.object({
  userValue: text(600).min(1),
  originality: text(600).min(1),
  feasibility: text(600).min(1),
  demoClarity: text(600).min(1),
});
export const conceptSchema = z.object({
  source: z.enum(["demo", "live"]).optional(),
  id: text(150).min(1),
  title: text(120).min(1),
  pitch: text(800).min(1),
  mechanism: text(600).min(1).optional(),
  assessment: assessmentSchema.optional(),
  assumptions: z.array(text(600).min(1)).min(1).max(6).optional(),
  inheritedFrom: z
    .array(
      z.object({ conceptId: text(150).min(1), contribution: text(600).min(1) }),
    )
    .max(2)
    .optional(),
  perspectives: z.array(text(100).min(1)).min(1).max(10),
  score: z.number().int().min(0).max(100).default(0),
  pros: z.array(text(300).min(1)).min(1).max(6),
  cons: z.array(text(300).min(1)).min(1).max(6),
  parentId: text(150).optional(),
  mutation: text(100).optional(),
  dimmed: z.boolean().optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
});
export const generatedConceptSchema = conceptSchema
  .omit({
    source: true,
    inheritedFrom: true,
    id: true,
    parentId: true,
    mutation: true,
    dimmed: true,
    x: true,
    y: true,
  })
  .extend({
    mechanism: text(600).min(1),
    assessment: assessmentSchema,
    assumptions: z.array(text(600).min(1)).min(1).max(6),
  });
export const conceptAssessmentSchema = generatedConceptSchema.pick({
  mechanism: true,
  assessment: true,
  assumptions: true,
});
export const generatedConceptsSchema = z
  .object({
    concepts: z.array(generatedConceptSchema).length(3),
  })
  .superRefine((value, ctx) => {
    if (hasDuplicateMechanisms(value.concepts))
      ctx.addIssue({
        code: "custom",
        path: ["concepts"],
        message:
          "Concepts repeat a mechanism or pitch. Replace repeated concepts with a materially different interaction and causal mechanism, not renamed wording.",
      });
  });
export const generatedMutationSchema = z
  .object({
    concepts: z.array(generatedConceptSchema).min(1).max(2),
  })
  .superRefine((value, ctx) => {
    if (hasDuplicateMechanisms(value.concepts))
      ctx.addIssue({
        code: "custom",
        path: ["concepts"],
        message:
          "Child concepts must use different mechanisms and interactions.",
      });
  });
export const generatedCombinationSchema = z.object({
  concepts: z
    .array(
      generatedConceptSchema.extend({
        inheritedFrom: z
          .array(
            z.object({
              conceptId: text(150).min(1),
              contribution: text(600).min(1),
            }),
          )
          .length(2),
      }),
    )
    .length(1),
});
const experimentSchema = z.object({
  hypothesis: text(1000).min(1),
  steps: z.array(text(700).min(1)).min(2).max(6),
  successSignal: text(1000).min(1),
});
const scopeSchema = z.object({
  mustBuild: z.array(text(700).min(1)).min(1).max(6),
  cut: z.array(text(700).min(1)).min(1).max(8),
});
export const crucibleSchema = z.object({
  verdict: text(800).min(1),
  score: z.number().int().min(0).max(100).default(0),
  experiment: experimentSchema.optional(),
  scope: scopeSchema.optional(),
  judgeReaction: text(2000).min(1),
  benchmark: text(1500).min(1),
  pros: z.array(text(600).min(1)).min(2).max(8),
  cons: z.array(text(600).min(1)).min(2).max(8),
  weakestAssumption: z.object({
    assumption: text(1000).min(1),
    fix: text(1000).min(1),
    test: text(1000).min(1),
  }),
  blueprint: z.object({
    signals: z.array(text(500).min(1)).min(2).max(10),
    architecture: z.array(text(700).min(1)).min(2).max(10),
    timeline: z
      .array(z.object({ hours: text(60).min(1), task: text(700).min(1) }))
      .min(3)
      .max(8),
    demo: z
      .array(z.object({ seconds: text(60).min(1), action: text(700).min(1) }))
      .min(3)
      .max(8),
  }),
});
export const generatedCrucibleSchema = crucibleSchema.extend({
  experiment: experimentSchema,
  scope: scopeSchema,
});
const demo = z.boolean().default(false);
export const exploreRequestSchema = z.object({
  brief: briefSchema,
  avoidMechanisms: z.array(text(400).min(1)).max(180).optional(),
  perspectives: z.array(perspectiveSchema).min(1).max(15),
  demo,
});
export const synthesizeRequestSchema = z
  .object({
    brief: briefSchema,
    ingredients: z.array(ingredientSchema).min(2).max(6),
    demo,
  })
  .refine(
    (value) =>
      new Set(value.ingredients.map((item) => item.id)).size ===
      value.ingredients.length,
    { message: "Choose distinct ingredients.", path: ["ingredients"] },
  );
export const mutateRequestSchema = z
  .object({
    brief: briefSchema,
    parent: conceptSchema,
    type: z.enum(["autonomous", "widget", "invert", "wildcard", "splice"]),
    ingredient: ingredientSchema.optional(),
    perspective: perspectiveSchema.optional(),
    demo,
  })
  .superRefine((value, ctx) => {
    if (value.type === "splice" && !value.ingredient)
      ctx.addIssue({
        code: "custom",
        path: ["ingredient"],
        message: "Choose an ingredient to splice.",
      });
    if (value.type === "wildcard" && !value.perspective)
      ctx.addIssue({
        code: "custom",
        path: ["perspective"],
        message: "Choose a wildcard perspective.",
      });
  });
export const crucibleRequestSchema = z.object({
  brief: briefSchema,
  concept: conceptSchema,
  demo,
});
export const combineRequestSchema = z
  .object({
    brief: briefSchema,
    concepts: z.tuple([conceptSchema, conceptSchema]),
    demo,
  })
  .refine((value) => value.concepts[0].id !== value.concepts[1].id, {
    message: "Choose two different ideas to combine.",
    path: ["concepts"],
  });

// A conservative lexical check catches repeated mechanisms without pretending to
// measure semantic novelty. The model also receives an explicit diversity task.
const duplicateStopWords = new Set(
  "a an the and or of to in on for with from by as is are that this their its one two use uses using user users people make makes helps help into then when automatically".split(
    " ",
  ),
);
function mechanismTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/u)
      .filter((token) => token.length > 2 && !duplicateStopWords.has(token))
      .map((token) => token.replace(/(?:ing|ed|s)$/u, "")),
  );
}
export function nearDuplicateText(
  left: string,
  right: string,
  threshold = 0.72,
): boolean {
  const a = mechanismTokens(left),
    b = mechanismTokens(right);
  if (!a.size || !b.size)
    return left.trim().toLowerCase() === right.trim().toLowerCase();
  const shared = [...a].filter((token) => b.has(token)).length;
  return (2 * shared) / (a.size + b.size) >= threshold;
}
export function hasDuplicateMechanisms(
  concepts: { mechanism?: string; pitch: string }[],
) {
  return concepts.some((concept, index) =>
    concepts
      .slice(0, index)
      .some(
        (other) =>
          Boolean(
            concept.mechanism &&
              other.mechanism &&
              nearDuplicateText(concept.mechanism, other.mechanism),
          ) || nearDuplicateText(concept.pitch, other.pitch, 0.82),
      ),
  );
}

export function wordCount(value: string) {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}
export function containsForbidden(value: string, forbiddenWords: string[]) {
  const tokens = value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter(Boolean)
    .join(" ");
  return forbiddenWords.some((word) => {
    const phrase = word
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/u)
      .filter(Boolean)
      .join(" ");
    return phrase.length > 0 && ` ${tokens} `.includes(` ${phrase} `);
  });
}
export function explorationOutputSchema(perspective: Perspective) {
  return z
    .object({
      provocation: text(300).min(1),
      mechanic: text(400).min(1),
      flip: text(400).min(1),
    })
    .superRefine((value, ctx) => {
      for (const key of ["provocation", "mechanic", "flip"] as const) {
        const limit = key === "provocation" ? 15 : 20;
        if (wordCount(value[key]) > limit)
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `Must contain at most ${limit} words.`,
          });
        if (containsForbidden(value[key], perspective.forbiddenWords))
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Contains a forbidden word.",
          });
      }
    });
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Read streams incrementally so chunked bodies receive the same size limit. */
export async function readRequest<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  const limit = 96 * 1024;
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(
      415,
      "Send this request as application/json.",
      "INVALID_CONTENT_TYPE",
    );
  const size = Number(request.headers.get("content-length") || "0");
  if (size > limit)
    throw new ApiError(
      413,
      "The workshop request is too large. Shorten the brief or selected text.",
      "BODY_TOO_LARGE",
    );
  if (!request.body)
    throw new ApiError(400, "A JSON request body is required.", "INVALID_BODY");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let body = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new ApiError(
          413,
          "The workshop request is too large.",
          "BODY_TOO_LARGE",
        );
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new ApiError(
      400,
      "The request body is not valid JSON.",
      "INVALID_JSON",
    );
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(
      400,
      `${issue.path.join(".") || "Request"}: ${issue.message}`,
      "VALIDATION_ERROR",
    );
  }
  return result.data;
}

export async function apiResponse<T>(run: () => Promise<T>): Promise<Response> {
  try {
    return Response.json(await run(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const known = error instanceof ApiError;
    if (!known)
      console.error(
        "[Offscript] Unexpected API failure:",
        error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error),
      );
    else if (error.status >= 500 || error.code.startsWith("AI_") || error.code.startsWith("RESEARCH_"))
      console.error(`[Offscript] API error ${error.status} ${error.code}: ${error.message}`);
    return Response.json(
      {
        error: known
          ? error.message
          : "Something interrupted this operation. Please try again.",
        code: known ? error.code : "INTERNAL_ERROR",
      },
      {
        status: known ? error.status : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
