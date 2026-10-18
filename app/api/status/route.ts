import { isConfigured, MODEL } from "@/lib/ai";

export function GET() {
  return Response.json(
    { configured: isConfigured(), model: MODEL },
    { headers: { "Cache-Control": "no-store" } },
  );
}
