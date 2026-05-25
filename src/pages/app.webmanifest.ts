import type { APIRoute } from "astro";

function getStartUrl(url: URL) {
  const startUrl = url.searchParams.get("start_url") ?? "/";

  if (!startUrl.startsWith("/")) return "/";
  if (startUrl.startsWith("//")) return "/";

  return startUrl;
}

export const GET: APIRoute = ({ url }) => {
  const startUrl = getStartUrl(url);

  return new Response(
    JSON.stringify(
      {
        name: "TasaDolar",
        short_name: "TasaDolar",
        description: "Tasas de cambio BCV, Binance P2P y Euro con convertidor.",
        id: startUrl,
        start_url: startUrl,
        scope: "/",
        display: "standalone",
        display_override: [
          "window-controls-overlay",
          "standalone",
          "minimal-ui",
        ],
        background_color: "#0a0a0a",
        theme_color: "#0a0a0a",
        orientation: "portrait",
        categories: ["finance", "utilities"],
        lang: "es-VE",
        dir: "ltr",
        shortcuts: [
          {
            name: "Convertidor",
            short_name: "Convertir",
            description: "Abrir el convertidor de tasas.",
            url: startUrl,
            icons: [
              {
                src: "/icons/icon-192x192.png",
                sizes: "192x192",
                type: "image/png",
              },
            ],
          },
        ],
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    },
  );
};
