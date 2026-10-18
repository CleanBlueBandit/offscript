import { canonicalPerspectives, exploreLive } from "@/lib/ai";
import { exploreDemo } from "@/lib/demo";
import {
  apiResponse,
  exploreRequestSchema,
  readRequest,
} from "@/lib/validation";

export const maxDuration = 120;
export async function POST(request: Request) {
  return apiResponse(async () => {
    const input = await readRequest(request, exploreRequestSchema);
    const perspectives = canonicalPerspectives(input.perspectives);
    const explorations = input.demo
      ? exploreDemo(input.brief, perspectives, input.avoidMechanisms)
      : await exploreLive(input.brief, perspectives, input.avoidMechanisms);
    return { explorations, mode: input.demo ? "demo" : "live" };
  });
}
