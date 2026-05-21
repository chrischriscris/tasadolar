# AGENTS.md

Guidance for AI coding agents working in this repository.

## Key Principles

**Performance is the top priority.** Minimize client-side JS, keep bundle size as small as possible. Prefer Astro components (zero JS) over React. Use vanilla `<script>` tags only when interactivity is unavoidable. Never add a framework component where an Astro component suffices.

## Commands

`npm run dev` / `npm run build` / `npm run preview`. Format with `npx prettier --check .`. No test runner.

## Stack

Astro 6 (server), Tailwind v4 (Vite plugin), Cloudflare Workers. Path alias: `@/*` → `./src/*`.

## Deployment

`astro.config.mjs` uses the Cloudflare adapter. `wrangler.jsonc` is the deployment entrypoint and enables Cloudflare observability.

## Architecture

`src/lib/` fetches rates at build time: `bcv.ts` (BCV official via ve.dolarapi.com), `binance.ts` (USDT/VES mid-market via Binance P2P). `rates.ts` orchestrates all fetches in parallel and computes derived values (brecha cambiaria, BCV/USDT conversions). `types.ts` has the shared `Rate` discriminated union (narrow on `.error`).

`index.astro` calls `fetchAllRates()` in frontmatter, renders Astro components. Client-side `<script>` handles tab switching and converter via DOM `data-` attributes with es-VE number formatting.

All components are `.astro` files — no React components despite the integration being available.
