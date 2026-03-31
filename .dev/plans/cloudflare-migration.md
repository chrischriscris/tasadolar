# Migration Plan: Vercel -> Cloudflare

## 1. Set Up D1 Database (for Rate History)

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

## 2. Create the Cron Worker (Fetches Rates -> D1)

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

## 3. Update the Page to Read from D1

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

## 4. Database Strategy & Mobile Access

### D1 Limitations

**Vendor lock-in:**

- API is Cloudflare-specific (`env.DB.prepare()`)
- Only runs inside Workers runtime
- No standard SQLite connection protocol

**Mitigating factors:**

- Standard SQLite syntax (portable queries/schemas)
- Data exportable via `wrangler d1 export`
- Migration to any SQLite database requires minimal query changes

**Mobile access:**

- D1 is **server-side only** — mobile apps cannot connect directly
- Would require building a Worker API for mobile access
- No built-in auth or Row Level Security (unlike Supabase)

### Alternative: Supabase (PostgreSQL)

**Pros:**

- Direct client SDK access (iOS/Android/Flutter)
- Built-in auth + Row Level Security
- Auto-generated REST API
- Real-time subscriptions
- Zero data lock-in (standard PostgreSQL, exportable anywhere)
- Open-source stack (self-hostable)

**Cons:**

- Higher latency (~50-200ms vs D1's <10ms)
- External network call from Cloudflare Worker
- Would break the "performance is top priority" principle

### Recommended: Hybrid Architecture

Use both D1 (primary) and Supabase (mobile + backup):

```
Cron Worker (every 5 min)
  ├─→ D1 (primary, <10ms latency for web SSR)
  └─→ Supabase (mobile SDK access + backup)
```

**Implementation:**

```ts
// src/workers/cron-rates.ts
export default {
  async scheduled(controller, env, ctx) {
    const rates = await fetchAllRates();

    await Promise.all([
      // D1 (fast, co-located with Worker)
      env.DB.prepare(
        "INSERT INTO rates (source, price, api_updated_at) VALUES (?, ?, ?)",
      )
        .bind(rate.source, rate.price, rate.apiUpdatedAt)
        .run(),

      // Supabase (mobile access + backup)
      fetch("https://xxx.supabase.co/rest/v1/rates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify(rate),
      }),
    ]);
  },
};
```

**Benefits:**

- Web stays fast (D1 co-located with Worker)
- Mobile gets native SDK + realtime via Supabase
- Automatic backup/redundancy
- Clear migration path if leaving Cloudflare
- No mobile auth complexity (Supabase RLS handles it)

### Latency Comparison

| Architecture        | Latency                                |
| ------------------- | -------------------------------------- |
| D1 only             | <10ms (Worker + DB same edge location) |
| Supabase only       | 50-200ms (external API call)           |
| Hybrid (D1 for web) | <10ms for web, Supabase for mobile     |

### Decision Matrix

| Need                    | Recommended            |
| ----------------------- | ---------------------- |
| Maximum web performance | D1 only                |
| Mobile app access       | Supabase (or hybrid)   |
| Avoid vendor lock-in    | Supabase (or hybrid)   |
| Both + redundancy       | Hybrid (D1 + Supabase) |

## 5. Architecture After Migration

```
User request
  -> Cloudflare Pages (SSR)
    -> reads latest rates from D1 (sub-ms, co-located)
    -> returns HTML

Cron (every 5 min)
  -> Cloudflare Worker
    -> calls BCV API + Binance P2P API
    -> writes fresh rates to D1 (and optionally Supabase)
```

## 6. Relevant Docs

- Astro Cloudflare adapter: https://docs.astro.build/en/guides/deploy/cloudflare/
- Cloudflare Pages + Astro: https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/
- D1 getting started: https://developers.cloudflare.com/d1/get-started/
- Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Wrangler config: https://developers.cloudflare.com/workers/wrangler/configuration/

## 7. Free Tier Limits

### Cloudflare

| Resource         | Limit                |
| ---------------- | -------------------- |
| Workers requests | 100K/day (~3M/month) |
| D1 reads         | 5M/day               |
| D1 writes        | 100K/day             |
| D1 storage       | 5 GB                 |
| Cron triggers    | 5 per Worker         |
| Bandwidth        | Unlimited            |

### Supabase

| Resource               | Limit                     |
| ---------------------- | ------------------------- |
| Database               | 500 MB                    |
| Bandwidth              | 5 GB/month                |
| API requests           | Unlimited                 |
| Concurrent connections | 60 (direct), 200 (pooler) |
