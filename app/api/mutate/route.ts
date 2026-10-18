import { canonicalPerspectives, mutateLive } from "@/lib/ai";
import { mutateDemo } from "@/lib/demo";
import {
  apiResponse,
  conceptSchema,
  mutateRequestSchema,
  readRequest,
} from "@/lib/validation";

export const maxDuration = 120;
export async function POST(request: Request) {
  return apiResponse(async () => {
    const input = await readRequest(request, mutateRequestSchema);
    const perspective = input.perspective
      ? canonicalPerspectives([input.perspective])[0]
      : undefined;
    const result = input.demo
      ? mutateDemo(
          input.brief,
          input.parent,
          input.type,
          input.ingredient,
          perspective,
        )
      : await mutateLive(
          input.brief,
          input.parent,
          input.type,
          input.ingredient,
          perspective,
        );
    const concepts = conceptSchema.array().min(1).max(2).parse(result);
    return { concepts, mode: input.demo ? "demo" : "live" };
  });
}
