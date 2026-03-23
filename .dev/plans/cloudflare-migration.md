# Migration Plan: Vercel -> Cloudflare

## 1. Create a Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up with email + password (or GitHub OAuth)
3. Pick the free plan — it covers everything we need

## 2. Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

This opens a browser window to authorize the CLI with your Cloudflare account.

## 3. Swap the Astro Adapter

```bash
npm remove @astrojs/vercel
npm install @astrojs/cloudflare
```

Update `astro.config.mjs`:

```js
// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [react()],
});
```

## 4. Add Wrangler Config

Create `wrangler.jsonc` at the project root:

```jsonc
{
  "name": "tasadolar",
  "compatibility_date": "2024-12-01",
  "pages_build_output_dir": "./dist",
}
```

## 5. Deploy (Verify It Works Before Adding DB)

```bash
npm run build
wrangler pages deploy dist
```

Alternatively, connect the GitHub repo from the Cloudflare dashboard:
Dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git

This gives you automatic deploys on push, same as Vercel.

## 6. Set Up D1 Database (for Rate History)

### Create the database

```bash
wrangler d1 create tasadolar-rates
```

This outputs a database ID. Add it to `wrangler.jsonc`:

```jsonc
{
  "name": "tasadolar",
  "compatibility_date": "2024-12-01",
  "pages_build_output_dir": "./dist",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "tasadolar-rates",
      "database_id": "<the-id-from-the-command-above>",
    },
  ],
}
```

### Create the schema

Create `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,        -- 'bcv-usd', 'bcv-eur', 'binance'
  price REAL NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  api_updated_at TEXT           -- the upstream API's own timestamp
);

CREATE INDEX idx_rates_source_fetched ON rates(source, fetched_at DESC);
```

Apply it:

```bash
wrangler d1 execute tasadolar-rates --file=schema.sql        # production
wrangler d1 execute tasadolar-rates --file=schema.sql --local # local dev
```

## 7. Create the Cron Worker (Fetches Rates -> D1)

This is a separate Worker (or a scheduled handler in the same project) that
runs on a schedule, calls BCV + Binance APIs, and inserts rows into D1.

Create `src/workers/cron-rates.ts` (or similar):

```ts
export default {
  async scheduled(controller, env, ctx) {
    // Reuse existing fetch logic from src/lib/bcv.ts and src/lib/binance.ts
    // Insert results into D1:
    //
    // await env.DB.prepare(
    //   "INSERT INTO rates (source, price, api_updated_at) VALUES (?, ?, ?)"
    // ).bind(source, price, updatedAt).run();
  },
};
```

Add cron schedule to `wrangler.jsonc`:

```jsonc
{
  "triggers": {
    "crons": ["*/5 * * * *"], // every 5 minutes, adjust as needed
  },
}
```

## 8. Update the Page to Read from D1

Change `fetchAllRates()` in `src/lib/rates.ts` to query D1 instead of
calling external APIs directly:

```ts
// In Astro, access the D1 binding via the request context:
// const db = Astro.locals.runtime.env.DB;
//
// const latest = await db.prepare(`
//   SELECT source, price, api_updated_at
//   FROM rates
//   WHERE fetched_at = (
//     SELECT MAX(fetched_at) FROM rates r2 WHERE r2.source = rates.source
//   )
// `).all();
```

This makes page loads fast (single DB read, no external API calls).

## 9. Cleanup

- Delete `.vercel/` directory
- Remove `@vercel/analytics` and `@vercel/speed-insights` from package.json
  (replace with Cloudflare Web Analytics if desired — it's free and
  privacy-friendly, just a script tag from the dashboard)
- Remove Vercel project from the Vercel dashboard
- Update DNS if using a custom domain (point it to Cloudflare Pages)

## Architecture After Migration

```
User request
  -> Cloudflare Pages (SSR)
    -> reads latest rates from D1 (sub-ms, co-located)
    -> returns HTML

Cron (every 5 min)
  -> Cloudflare Worker
    -> calls BCV API + Binance P2P API
    -> writes fresh rates to D1
```

## Relevant Docs

- Astro Cloudflare adapter: https://docs.astro.build/en/guides/deploy/cloudflare/
- Cloudflare Pages + Astro: https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/
- D1 getting started: https://developers.cloudflare.com/d1/get-started/
- Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Wrangler config: https://developers.cloudflare.com/workers/wrangler/configuration/

## Free Tier Limits (for reference)

| Resource         | Limit                |
| ---------------- | -------------------- |
| Workers requests | 100K/day (~3M/month) |
| D1 reads         | 5M/day               |
| D1 writes        | 100K/day             |
| D1 storage       | 5 GB                 |
| Cron triggers    | 5 per Worker         |
| Bandwidth        | Unlimited            |
