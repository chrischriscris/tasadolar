import type { APIRoute } from "astro";
import { buildAgentRates, formatAgentRatesMarkdown } from "@/lib/agent-rates";
import { fetchAllRates } from "@/lib/rates";

export const GET: APIRoute = async ({ request, site }) => {
  const origin = site?.href ?? new URL(request.url).origin;
  const feed = buildAgentRates(await fetchAllRates(), origin);

  return new Response(formatAgentRatesMarkdown(feed, origin), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
};
