import type { APIRoute } from "astro";

export const GET: APIRoute = ({ request, site }) => {
  const origin = site?.href ?? new URL(request.url).origin;
  const url = new URL("/", origin).href;
  const lastmod = new Date().toISOString();

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    },
  );
};
