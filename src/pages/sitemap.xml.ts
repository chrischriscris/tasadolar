import type { APIRoute } from "astro";
import { rateDefinitions } from "@/lib/rate-definitions";

export const GET: APIRoute = ({ request, site }) => {
  const origin = site?.href ?? new URL(request.url).origin;
  const paths = ["/", ...rateDefinitions.map((rate) => `/${rate.slug}`)];
  const lastmod = new Date().toISOString();
  const urls = paths
    .map((path) => {
      const url = new URL(path, origin).href;
      const priority = path === "/" ? "1.0" : "0.8";

      return `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    },
  );
};
