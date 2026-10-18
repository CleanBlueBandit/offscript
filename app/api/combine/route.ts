import { combineLive } from "@/lib/ai";
import { combineDemo } from "@/lib/demo";
import {
  apiResponse,
  combineRequestSchema,
  conceptSchema,
  readRequest,
} from "@/lib/validation";

export const maxDuration = 120;
export async function POST(request: Request) {
  return apiResponse(async () => {
    const input = await readRequest(request, combineRequestSchema);
    const result = input.demo
      ? combineDemo(input.brief, input.concepts)
      : await combineLive(input.brief, input.concepts);
    return {
      concepts: conceptSchema.array().length(1).parse(result),
      mode: input.demo ? "demo" : "live",
    };
  });
}
