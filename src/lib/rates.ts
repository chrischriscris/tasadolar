// ---------------------------------------------------------------------------
// rates.ts – Orchestrator module
//
// Single entry point to fetch all exchange rates and compute derived values.
// Import `fetchAllRates()` from any Astro frontmatter to get everything.
//
// Called per request from Astro frontmatter and from src/pages/rates.json.ts
// and src/pages/llms.txt.ts.
//
// ARCHITECTURE NOTES (for when you revisit this):
// ------------------------------------------------
// - Each source (bcv.ts, binance.ts) handles its own fetch + error handling
//   and returns a `Rate` (see types.ts).
// - USDT uses Binance P2P, falling back to dolarapi's "paralelo" rate.
// - Results are cached in memory per Worker isolate for CACHE_TTL_MS
//   (ERROR_CACHE_TTL_MS when any source failed or is stale).
// - If a source fails, its last good value (up to STALE_MAX_MS old) is reused
//   and marked `stale`; with none available the card gets `value: null` plus
//   an `error` message, and derived rates that depend on it are null too.
//
// WHAT TO CHANGE WHEN ADDING A NEW RATE:
// ------------------------------------------------
// 1. Add an entry to `rateDefinitions` in rate-definitions.ts
// 2. For a new upstream, create src/lib/<source>.ts returning Promise<Rate>
//    and call it in fetchAllRates() below
// 3. Add its value to the `values` map here and its agent description in
//    agent-rates.ts (both are typed Record<RateId, ...>, so the compiler
//    lists what is missing)
// 4. Add an icon if needed (`RateIcon` in rate-definitions.ts and the icon
//    map in src/components/RateCard.astro)
// ---------------------------------------------------------------------------

import type { Rate, RateResult } from "./types";
import { fetchDolares, fetchBcvEur } from "./bcv";
import { fetchBinanceP2PRate } from "./binance";
import { ceilToDecimals } from "./number-format";
import { formatUpdatedAt } from "./date-format";
import {
  rateDefinitions,
  type CurrencyTab,
  type DisplayUnit,
  type RateIcon,
  type RateId,
} from "./rate-definitions";

const CACHE_TTL_MS = 60_000;

let cachedRates: { expiresAt: number; data: AllRates } | undefined;

const ERROR_CACHE_TTL_MS = 15_000;
const STALE_MAX_MS = 6 * 60 * 60_000;

type SourceKey = keyof AllRates["raw"];

const lastGood: Partial<Record<SourceKey, { rate: RateResult; at: number }>> =
  {};

/** Use the fresh rate, or the last good one (≤ 6 h old) when the fetch failed */
function withLastGood(
  key: SourceKey,
  rate: Rate,
  now: number,
): { rate: Rate; at: number } {
  if (rate.error === undefined) {
    lastGood[key] = { rate, at: now };
    return { rate, at: now };
  }
  const previous = lastGood[key];
  if (previous && now - previous.at <= STALE_MAX_MS) {
    return { rate: { ...previous.rate, stale: true }, at: previous.at };
  }
  return { rate, at: now };
}

/** Shape expected by RateCard.astro */
export interface RateCardData {
  id: RateId;
  title: string;
  href?: string;
  value: number | null;
  change: number; // TODO: implement daily change tracking (needs historical data)
  icon: RateIcon;
  currency: CurrencyTab;
  displayUnit: DisplayUnit;
  visibleTabs: CurrencyTab[];
  error?: string;
  /** BCV value date (ISO), only on official BCV cards with a value */
  effectiveDate?: string;
}

type RateValue = {
  value: number | null;
  error?: string;
};

export interface AllRates {
  /** Rate cards to pass to <RatesList rates={cards} /> */
  cards: RateCardData[];

  /** Exchange gap percentage (USDT vs official BCV); null when either rate is unavailable */
  exchangeGapPercentage: number | null;

  /** "Actualizado <fecha y hora de Caracas>" or "Sin datos" */
  lastUpdatedText: string;

  /** ISO 8601 time at which these rates were fetched */
  fetchedAt: string;

  /** Raw Rate results if you need them */
  raw: {
    bcvUsd: Rate;
    binance: Rate;
    bcvEur: Rate;
  };
}

function getRatePrice(rate: Rate): number | null {
  if (rate.error !== undefined) return null;
  if (!Number.isFinite(rate.price) || rate.price <= 0) return null;
  return ceilToDecimals(rate.price);
}

/** Binance P2P when available, otherwise dolarapi's paralelo rate */
function pickUsdtRate(binance: Rate, paralelo: Rate): Rate {
  if (binance.error === undefined) return binance;
  if (paralelo.error === undefined) return paralelo;
  return {
    source: "Binance P2P",
    error: `${binance.error}; fallback: ${paralelo.error}`,
  };
}

/**
 * Fetch all exchange rates from all sources.
 * Call this in Astro frontmatter:
 *
 * ```ts
 * import { fetchAllRates } from "@/lib/rates";
 * const { cards, exchangeGapPercentage, lastUpdatedText, fetchedAt } = await fetchAllRates();
 * ```
 */
export async function fetchAllRates(): Promise<AllRates> {
  const now = Date.now();
  if (cachedRates && cachedRates.expiresAt > now) return cachedRates.data;

  // -- Fetch all sources in parallel ----------------------------------------
  const [dolares, binanceP2P, bcvEurFresh] = await Promise.all([
    fetchDolares(),
    fetchBinanceP2PRate(),
    fetchBcvEur(),
  ]);
  const usd = withLastGood("bcvUsd", dolares.oficial, now);
  const usdt = withLastGood(
    "binance",
    pickUsdtRate(binanceP2P, dolares.paralelo),
    now,
  );
  const eur = withLastGood("bcvEur", bcvEurFresh, now);
  const bcvUsd = usd.rate;
  const binance = usdt.rate;
  const bcvEur = eur.rate;
  const dataAt = Math.min(usd.at, usdt.at, eur.at);

  // -- Extract prices (null if failed) --------------------------------------
  const bcvUsdPrice = getRatePrice(bcvUsd);
  const binancePrice = getRatePrice(binance);
  const bcvEurPrice = getRatePrice(bcvEur);
  const bcvToUsdtRate =
    bcvUsdPrice !== null && binancePrice !== null
      ? ceilToDecimals(bcvUsdPrice / binancePrice)
      : null;
  const usdtToBcvRate =
    bcvUsdPrice !== null && binancePrice !== null
      ? ceilToDecimals(binancePrice / bcvUsdPrice)
      : null;

  // -- Build rate cards for RateCard.astro -----------------------------------
  // NOTE: `change` is hardcoded to 0 for now. To implement daily change %,
  // you'd need to store yesterday's rate and compute the delta.
  // See TODO below.
  const values = {
    "bcv-usd": { value: bcvUsdPrice, error: bcvUsd.error },
    "binance-usd": { value: binancePrice, error: binance.error },
    "bcv-to-usdt": {
      value: bcvToUsdtRate,
      error:
        bcvUsdPrice === null || binancePrice === null
          ? "BCV or Binance unavailable"
          : undefined,
    },
    "usdt-to-bcv": {
      value: usdtToBcvRate,
      error:
        bcvUsdPrice === null || binancePrice === null
          ? "BCV or Binance unavailable"
          : undefined,
    },
    "bcv-eur": { value: bcvEurPrice, error: bcvEur.error },
  } satisfies Record<RateId, RateValue>;

  const effectiveDates: Partial<Record<RateId, string>> = {
    "bcv-usd": bcvUsdPrice !== null ? bcvUsd.updatedAt : undefined,
    "bcv-eur": bcvEurPrice !== null ? bcvEur.updatedAt : undefined,
  };

  const cards: RateCardData[] = rateDefinitions.map((definition) => ({
    id: definition.id,
    title: definition.cardTitle,
    href: `/${definition.slug}/`,
    value: values[definition.id].value,
    change: 0, // TODO: track daily change
    icon: definition.icon,
    currency: definition.currency,
    displayUnit: definition.displayUnit,
    visibleTabs: [...definition.visibleTabs],
    error: values[definition.id].error,
    effectiveDate: effectiveDates[definition.id],
  }));

  // -- Compute exchange gap ---------------------------------------------------
  const exchangeGapPercentage =
    bcvUsdPrice !== null && binancePrice !== null
      ? Number((((binancePrice - bcvUsdPrice) / bcvUsdPrice) * 100).toFixed(2))
      : null;

  // -- Format last updated text ----------------------------------------------
  const fetchedAt = new Date(dataAt).toISOString();
  const hasAnyRate = [bcvUsd, binance, bcvEur].some(
    (rate) => rate.error === undefined,
  );
  const lastUpdatedText = hasAnyRate
    ? `Actualizado ${formatUpdatedAt(new Date(dataAt))}`
    : "Sin datos";

  const data = {
    cards,
    exchangeGapPercentage,
    lastUpdatedText,
    fetchedAt,
    raw: { bcvUsd, binance, bcvEur },
  };

  const degraded = [bcvUsd, binance, bcvEur].some(
    (rate) => rate.error !== undefined || rate.stale === true,
  );
  cachedRates = {
    expiresAt: now + (degraded ? ERROR_CACHE_TTL_MS : CACHE_TTL_MS),
    data,
  };
  return data;
}
