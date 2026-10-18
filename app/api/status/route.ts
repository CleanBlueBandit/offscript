import { isConfigured, MODEL } from "@/lib/ai";
import { researchConfigured } from "@/lib/research";

export function GET() {
  return Response.json(
    { configured: isConfigured(), model: MODEL, researchConfigured: researchConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
