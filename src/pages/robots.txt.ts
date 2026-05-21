import type { APIRoute } from "astro";

export const GET: APIRoute = ({ request, site }) => {
  const origin = site?.href ?? new URL(request.url).origin;

  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      `Sitemap: ${new URL("/sitemap.xml", origin).href}`,
      "",
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
};
