import { synthesizeLive } from "@/lib/ai";
import { synthesizeDemo } from "@/lib/demo";
import {
  apiResponse,
  conceptSchema,
  readRequest,
  synthesizeRequestSchema,
} from "@/lib/validation";

export const maxDuration = 120;
export async function POST(request: Request) {
  return apiResponse(async () => {
    const input = await readRequest(request, synthesizeRequestSchema);
    const result = input.demo
      ? synthesizeDemo(input.brief, input.ingredients)
      : await synthesizeLive(input.brief, input.ingredients);
    const concepts = conceptSchema.array().min(2).max(3).parse(result);
    return { concepts, mode: input.demo ? "demo" : "live" };
  });
}
