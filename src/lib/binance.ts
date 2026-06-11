// ---------------------------------------------------------------------------
// Binance P2P – USDT/VES mid-market rate
//
// Fetches the top 10 BUY and SELL ads from Binance P2P for USDT/VES,
// then calculates a mid-market price from the best bid/ask.
//
// This is the same approach used in the main branch.
// It does NOT use dolarapi.com's "paralelo" – it queries Binance directly.
//
// TODO: Consider caching to avoid hitting Binance on every build
// TODO: Consider adding payTypes filter for more accurate results
// ---------------------------------------------------------------------------

import type { Rate, BinanceP2PResponse } from "./types";
import { fetchParaleloUsd } from "./bcv";

const BINANCE_P2P_URL =
  "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";
const TIMEOUT_MS = 5_000;

async function fetchP2PAds(
  tradeType: "BUY" | "SELL",
  signal: AbortSignal,
): Promise<number[]> {
  const res = await fetch(BINANCE_P2P_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fiat: "VES",
      page: 1,
      rows: 10,
      tradeType,
      asset: "USDT",
      payTypes: [],
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Binance P2P returned ${res.status} for ${tradeType}`);
  }

  const data: BinanceP2PResponse = await res.json();

  if (!data.data || data.data.length === 0) {
    throw new Error(`No P2P ${tradeType} ads returned`);
  }

  const prices = data.data
    .map((ad) => Number(ad.adv.price))
    .filter((price) => Number.isFinite(price) && price > 0);

  if (prices.length === 0) {
    throw new Error(`No valid P2P ${tradeType} prices returned`);
  }

  return prices;
}

async function fetchBinanceP2PRate(): Promise<Rate> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const [buyPrices, sellPrices] = await Promise.all([
      fetchP2PAds("BUY", controller.signal),
      fetchP2PAds("SELL", controller.signal),
    ]);

    // Best price to sell USDT = highest BUY ad price
    const bestBuy = Math.max(...buyPrices);
    // Best price to buy USDT = lowest SELL ad price
    const bestSell = Math.min(...sellPrices);
    // Mid-market rate
    const midPrice = (bestBuy + bestSell) / 2;

    return {
      price: midPrice,
      updatedAt: new Date().toISOString(),
      source: "Binance P2P",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Binance P2P] Failed: ${message}`);
    return { source: "Binance P2P", error: message };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch the Binance rate, falling back to dolarapi's paralelo rate.
 * Remove this wrapper and export fetchBinanceP2PRate directly when a
 * dedicated Binance proxy or replacement source is available.
 */
export async function fetchBinanceRate(): Promise<Rate> {
  const binance = await fetchBinanceP2PRate();
  if (!binance.error) return binance;

  return fetchParaleloUsd();
}
