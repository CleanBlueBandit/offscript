import { crucibleLive } from "@/lib/ai";
import { crucibleDemo } from "@/lib/demo";
import {
  apiResponse,
  crucibleRequestSchema,
  crucibleSchema,
  readRequest,
} from "@/lib/validation";

export const maxDuration = 120;
export async function POST(request: Request) {
  return apiResponse(async () => {
    const input = await readRequest(request, crucibleRequestSchema);
    const result = input.demo
      ? crucibleDemo(input.brief, input.concept)
      : await crucibleLive(input.brief, input.concept);
    const crucible = crucibleSchema.parse(result);
    return { crucible, mode: input.demo ? "demo" : "live" };
  });
}
