import { assessLive } from "@/lib/ai";
import { assessDemo } from "@/lib/demo";
import {
  apiResponse,
  crucibleRequestSchema,
  conceptSchema,
  readRequest,
} from "@/lib/validation";

export const maxDuration = 120;
export async function POST(request: Request) {
  return apiResponse(async () => {
    const input = await readRequest(request, crucibleRequestSchema);
    const result = input.demo
      ? assessDemo(input.brief, input.concept)
      : await assessLive(input.brief, input.concept);
    return {
      concept: conceptSchema.parse(result),
      mode: input.demo ? "demo" : "live",
    };
  });
}
