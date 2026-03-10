// ---------------------------------------------------------------------------
// rates.ts – Orchestrator module
//
// Single entry point to fetch all exchange rates and compute derived values.
// Import `fetchAllRates()` from any Astro frontmatter to get everything.
//
// ARCHITECTURE NOTES (for when you revisit this):
// ------------------------------------------------
// - Each source (bcv.ts, binance.ts) handles its own fetch + error handling.
// - This module combines them and computes derived data (brecha, timestamps).
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

/** Shape expected by RateCard.astro */
export interface RateCardData {
  id: string;
  title: string;
  value: number;
  change: number; // TODO: implement daily change tracking (needs historical data)
  icon: "bcv" | "us" | "binance" | "eu";
  currency: "USD" | "EUR" | "BS";
  displayUnit: "BS" | "USD";
}

export interface AllRates {
  /** Rate cards to pass to <RateCard rates={cards} /> */
  cards: RateCardData[];

  /** Brecha cambiaria percentage (paralelo vs oficial) */
  brechaPercentage: number;

  /** Human-readable "last updated" text */
  lastUpdatedText: string;

  /** Raw Rate results if you need them */
  raw: {
    bcvUsd: Rate;
    binance: Rate;
    bcvEur: Rate;
  };
}

/** Format an ISO date into a relative "Actualizado hace Xm" string */
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
 * const { cards, brechaPercentage, lastUpdatedText } = await fetchAllRates();
 * ```
 */
export async function fetchAllRates(): Promise<AllRates> {
  // -- Fetch all sources in parallel ----------------------------------------
  const [bcvUsd, binance, bcvEur] = await Promise.all([
    fetchBcvUsd(),
    fetchBinanceRate(),
    fetchBcvEur(),
  ]);

  // -- Extract prices (0 if failed) -----------------------------------------
  const bcvUsdPrice = bcvUsd.price ?? 0;
  const binancePrice = binance.price ?? 0;
  const bcvEurPrice = bcvEur.price ?? 0;
  const bcvToUsdtRate =
    bcvUsdPrice > 0 && binancePrice > 0 ? bcvUsdPrice / binancePrice : 0;
  const usdtToBcvRate =
    bcvUsdPrice > 0 && binancePrice > 0 ? binancePrice / bcvUsdPrice : 0;

  // -- Build rate cards for RateCard.astro -----------------------------------
  // NOTE: `change` is hardcoded to 0 for now. To implement daily change %,
  // you'd need to store yesterday's rate and compute the delta.
  // See TODO below.
  const cards: RateCardData[] = [
    {
      id: "bcv-usd",
      title: "Tasa BCV",
      value: Number(bcvUsdPrice.toFixed(2)),
      change: 0, // TODO: track daily change
      icon: "bcv",
      currency: "USD",
      displayUnit: "BS",
    },
    {
      id: "binance-usd",
      title: "Tasa Binance (USDT)",
      value: Number(binancePrice.toFixed(2)),
      change: 0, // TODO: track daily change
      icon: "binance",
      currency: "USD",
      displayUnit: "BS",
    },
    {
      id: "bcv-to-usdt",
      title: "BCV -> USDT",
      value: Number(bcvToUsdtRate.toFixed(4)),
      change: 0,
      icon: "bcv",
      currency: "USD",
      displayUnit: "USD",
    },
    {
      id: "usdt-to-bcv",
      title: "USDT -> BCV",
      value: Number(usdtToBcvRate.toFixed(4)),
      change: 0,
      icon: "binance",
      currency: "USD",
      displayUnit: "USD",
    },
    {
      id: "bcv-eur",
      title: "Tasa Euro BCV",
      value: Number(bcvEurPrice.toFixed(2)),
      change: 0, // TODO: track daily change
      icon: "eu",
      currency: "EUR",
      displayUnit: "BS",
    },
  ];

  // -- Compute brecha cambiaria ----------------------------------------------
  const brechaPercentage =
    bcvUsdPrice > 0
      ? Number((((binancePrice - bcvUsdPrice) / bcvUsdPrice) * 100).toFixed(2))
      : 0;

  // -- Format last updated text ----------------------------------------------
  const lastUpdatedText = formatLastUpdated([
    bcvUsd.updatedAt,
    binance.updatedAt,
    bcvEur.updatedAt,
  ]);

  return {
    cards,
    brechaPercentage,
    lastUpdatedText,
    raw: { bcvUsd, binance, bcvEur },
  };
}
