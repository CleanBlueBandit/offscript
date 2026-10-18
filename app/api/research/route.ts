import { researchDemo, researchWithFallback } from "@/lib/research";
import { researchRequestSchema } from "@/lib/research-validation";
import { apiResponse, readRequest } from "@/lib/validation";

export const maxDuration = 180;

export async function POST(request: Request) {
  return apiResponse(async () => {
    const input = await readRequest(request, researchRequestSchema);
    const run = input.demo ? researchDemo(input) : await researchWithFallback(input);
    return { run };
  });
}
