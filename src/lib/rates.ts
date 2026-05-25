// ---------------------------------------------------------------------------
// rates.ts – Orchestrator module
//
// Single entry point to fetch all exchange rates and compute derived values.
// Import `fetchAllRates()` from any Astro frontmatter to get everything.
//
// ARCHITECTURE NOTES (for when you revisit this):
// ------------------------------------------------
// - Each source (bcv.ts, binance.ts) handles its own fetch + error handling.
// - This module combines them and computes derived data (exchange gap, timestamps).
// - The RateCard shape matches what `RateCard.astro` expects as props.
// - If a source fails, its entry gets `value: 0` so the UI still renders.
//
// WHAT TO CHANGE WHEN ADDING A NEW RATE SOURCE:
// ------------------------------------------------
// 1. Create src/lib/<source>.ts exporting a function that returns Promise<Rate>
// 2. Add the fetch call in fetchAllRates() below
// 3. Add a new entry in the `cards` array
// 4. Update RateCard.astro icon types if needed
//
// WHAT TO CHANGE WHEN SWITCHING TO SSR / CLIENT-SIDE:
// ------------------------------------------------
// - This module works at build time (static) or server time (SSR).
// - For client-side fetching, you'd create an API route (see main branch
//   src/pages/api/rates.ts) that calls this same module.
// - The components already read `data-base-rate` from DOM attributes,
//   so client-side updates only need to patch those attributes + text.
// ---------------------------------------------------------------------------

import type { Rate } from "./types";
import { fetchBcvUsd, fetchBcvEur } from "./bcv";
import { fetchBinanceRate } from "./binance";
import { ceilToDecimals } from "./number-format";
import {
  rateDefinitions,
  type CurrencyTab,
  type DisplayUnit,
  type RateIcon,
  type RateId,
} from "./rate-definitions";

const CACHE_TTL_MS = 60_000;

let cachedRates: { expiresAt: number; data: AllRates } | undefined;

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
}

type RateValue = {
  value: number | null;
  error?: string;
};

export interface AllRates {
  /** Rate cards to pass to <RatesList rates={cards} /> */
  cards: RateCardData[];

  /** Exchange gap percentage (USDT vs official BCV) */
  exchangeGapPercentage: number;

  /** Human-readable "last updated" text */
  lastUpdatedText: string;

  /** Raw Rate results if you need them */
  raw: {
    bcvUsd: Rate;
    binance: Rate;
    bcvEur: Rate;
  };
}

function getRatePrice(rate: Rate): number | null {
  if (rate.error || !Number.isFinite(rate.price) || rate.price <= 0)
    return null;
  return ceilToDecimals(rate.price);
}

/** Format an ISO date into a relative Spanish "last updated" string */
function formatLastUpdated(dates: (string | undefined)[]): string {
  const validDates = dates
    .filter((d): d is string => !!d)
    .map((d) => new Date(d).getTime())
    .filter((t) => !isNaN(t));

  if (validDates.length === 0) return "Sin datos";

  const mostRecent = new Date(Math.max(...validDates));
  const now = new Date();
  const diffMs = now.getTime() - mostRecent.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffMinutes < 1) return "Actualizado hace un momento";
  if (diffMinutes < 60) return `Actualizado hace ${diffMinutes}m`;
  if (diffHours < 24) return `Actualizado hace ${diffHours}h`;
  return `Actualizado: ${mostRecent.toLocaleDateString("es-VE")}`;
}

/**
 * Fetch all exchange rates from all sources.
 * Call this in Astro frontmatter:
 *
 * ```ts
 * import { fetchAllRates } from "@/lib/rates";
 * const { cards, exchangeGapPercentage, lastUpdatedText } = await fetchAllRates();
 * ```
 */
export async function fetchAllRates(): Promise<AllRates> {
  const now = Date.now();
  if (cachedRates && cachedRates.expiresAt > now) return cachedRates.data;

  // -- Fetch all sources in parallel ----------------------------------------
  const [bcvUsd, binance, bcvEur] = await Promise.all([
    fetchBcvUsd(),
    fetchBinanceRate(),
    fetchBcvEur(),
  ]);

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

  const cards: RateCardData[] = rateDefinitions.map((definition) => ({
    id: definition.id,
    title: definition.cardTitle,
    href: `/${definition.slug}`,
    value: values[definition.id].value,
    change: 0, // TODO: track daily change
    icon: definition.icon,
    currency: definition.currency,
    displayUnit: definition.displayUnit,
    visibleTabs: [...definition.visibleTabs],
    error: values[definition.id].error,
  }));

  // -- Compute exchange gap ---------------------------------------------------
  const exchangeGapPercentage =
    bcvUsdPrice !== null && binancePrice !== null
      ? Number((((binancePrice - bcvUsdPrice) / bcvUsdPrice) * 100).toFixed(2))
      : 0;

  // -- Format last updated text ----------------------------------------------
  const lastUpdatedText = formatLastUpdated([
    bcvUsd.updatedAt,
    binance.updatedAt,
    bcvEur.updatedAt,
  ]);

  const data = {
    cards,
    exchangeGapPercentage,
    lastUpdatedText,
    raw: { bcvUsd, binance, bcvEur },
  };

  cachedRates = { expiresAt: now + CACHE_TTL_MS, data };
  return data;
}
