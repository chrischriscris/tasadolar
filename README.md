# TasaDolar

Venezuelan exchange rate tracker — BCV official, Binance P2P parallel, and EUR rates with a currency converter.

Built with [Astro](https://astro.build) and deployed on [Cloudflare Workers](https://workers.cloudflare.com/).

## Commands

| Command             | Action                                       |
| :------------------ | :------------------------------------------- |
| `npm install`       | Install dependencies                         |
| `npm run dev`       | Start dev server at `localhost:4321`         |
| `npm run build`     | Build production site to `./dist/`           |
| `npm run preview`   | Preview build locally                        |
| `npm run astro ...` | Run Astro CLI commands (`add`, `check`, etc) |

## Deployment

- Uses the Astro Cloudflare adapter.
- Cloudflare observability is enabled in `wrangler.jsonc`.
