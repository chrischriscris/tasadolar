# AGENTS.md

Guidance for AI coding agents working in this repository.

## Key Principles

**Performance is the top priority.** Minimize client-side JS, keep bundle size as small as possible. Prefer Astro components (zero JS) over React. Use vanilla `<script>` tags only when interactivity is unavoidable. Never add a framework component where an Astro component suffices.

## Commands

`bun run dev` / `bun run build` / `bun run preview`. Unit tests: `bun run test`. E2E: `bun run test:e2e` (builds, then runs Playwright against `astro preview`; hits the live rate APIs). Typecheck: `bun run typecheck`. Format check: `bunx prettier --check .`. Deploy dry run: `bun run deploy:preview`.

## Stack

Astro 7 (`output: "server"`), Tailwind v4 (Vite plugin), Cloudflare Workers. Path alias: `@/*` → `./src/*`.

## Deployment

`astro.config.mjs` uses the Cloudflare adapter. `wrangler.jsonc` is the deployment entrypoint and enables Cloudflare observability. Production is https://tasadolar.net.

## Architecture

Rates are fetched per request (SSR); nothing is fetched during `astro build`. `bcv.ts` reads BCV official USD/EUR and the dolarapi "paralelo" USD rate from ve.dolarapi.com; `binance.ts` computes the USDT/VES mid-market price from Binance P2P. `rates.ts` runs the fetches in parallel and falls back to dolarapi "paralelo" for USDT when Binance fails (the rate's `source` says which was used). It caches results in memory per Worker isolate (60 s, or 15 s when any source failed or is stale) and reuses a source's last good value (up to 6 h, marked `stale`) when its fetch fails. It also computes derived values (brecha cambiaria, BCV/USDT conversions). A failed source yields `value: null` plus an `error`, never 0. `rate-definitions.ts` is the single source of truth for rate ids, slugs, labels and tabs. `types.ts` has the shared `Rate` discriminated union (narrow on `.error`).

`agent-rates.ts` turns the same data into agent-friendly output (dot decimals, currency pairs, ISO timestamps) served by `pages/llms.txt.ts` and `pages/rates.json.ts` (public at `/llms.txt` and `/rates.json`).

`index.astro` calls `fetchAllRates()` in frontmatter, renders Astro components. Client-side `<script>` handles tab switching and converter via DOM `data-` attributes with es-VE number formatting. `public/sw.js` is a hand-written service worker (stale-while-revalidate for pages, cache-first for assets); bump `CACHE_NAME` whenever its caching rules change.

All components are `.astro` files; there is no React integration, and none should be added.

Implementation plans for agents live in `plans/` (index: `plans/README.md`).
