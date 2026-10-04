import type { APIRoute } from "astro";
import { buildAgentRates } from "@/lib/agent-rates";
import { fetchAllRates } from "@/lib/rates";

export const GET: APIRoute = async ({ request, site }) => {
  const origin = site?.href ?? new URL(request.url).origin;

  return Response.json(buildAgentRates(await fetchAllRates(), origin), {
    headers: {
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
