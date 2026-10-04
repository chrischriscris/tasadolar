# TasaDolar

Venezuelan exchange rate tracker — BCV official, Binance P2P parallel, and EUR rates with a currency converter.

Built with [Astro](https://astro.build) and deployed on [Cloudflare Workers](https://workers.cloudflare.com/).

## Commands

| Command                  | Action                                                                            |
| :----------------------- | :-------------------------------------------------------------------------------- |
| `bun install`            | Install dependencies                                                              |
| `bun run dev`            | Start dev server at `localhost:4321`                                              |
| `bun run build`          | Build production site to `./dist/`                                                |
| `bun run test`           | Run the Vitest test suite once                                                    |
| `bun run test:watch`     | Run Vitest in watch mode                                                          |
| `bun run test:e2e`       | Build, serve with `astro preview`, run Playwright e2e tests (uses live rate APIs) |
| `bun run typecheck`      | Typecheck the project                                                             |
| `bun run deploy:preview` | Build and run `wrangler deploy --dry-run`                                         |
| `bun run deploy`         | Build and deploy to Cloudflare Workers                                            |
| `bun run preview`        | Preview build locally                                                             |
| `bun run astro ...`      | Run Astro CLI commands (`add`, `check`, etc)                                      |

## Deployment

- Production: https://tasadolar.net
- Uses the Astro Cloudflare adapter.
- Cloudflare observability is enabled in `wrangler.jsonc`.

## Agent feeds

- `/rates.json`: JSON, dot decimals, ISO timestamps, CORS-enabled
- `/llms.txt`: Markdown, per the llms.txt convention
