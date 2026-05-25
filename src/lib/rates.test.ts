import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Rate } from "./types";

const bcvUsdSuccess: Rate = {
  price: 100.001,
  updatedAt: "2026-05-25T10:00:00.000Z",
  source: "BCV",
};
const binanceSuccess: Rate = {
  price: 125,
  updatedAt: "2026-05-25T10:01:00.000Z",
  source: "Binance P2P",
};
const bcvEurSuccess: Rate = {
  price: 110.001,
  updatedAt: "2026-05-25T09:00:00.000Z",
  source: "BCV",
};

async function importRatesWithMocks({
  bcvUsd = bcvUsdSuccess,
  binance = binanceSuccess,
  bcvEur = bcvEurSuccess,
}: {
  bcvUsd?: Rate;
  binance?: Rate;
  bcvEur?: Rate;
} = {}) {
  vi.resetModules();
  vi.doMock("./bcv", () => ({
    fetchBcvUsd: vi.fn().mockResolvedValue(bcvUsd),
    fetchBcvEur: vi.fn().mockResolvedValue(bcvEur),
  }));
  vi.doMock("./binance", () => ({
    fetchBinanceRate: vi.fn().mockResolvedValue(binance),
  }));

  return import("./rates");
}

describe("fetchAllRates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T10:03:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock("./bcv");
    vi.doUnmock("./binance");
  });

  it("builds rate cards and derived exchange values", async () => {
    const { fetchAllRates } = await importRatesWithMocks();

    const result = await fetchAllRates();

    expect(result.exchangeGapPercentage).toBe(24.99);
    expect(result.lastUpdatedText).toBe("Actualizado hace 2m");
    expect(result.cards).toHaveLength(5);
    expect(result.cards.map((card) => card.id)).toEqual([
      "bcv-usd",
      "binance-usd",
      "usdt-to-bcv",
      "bcv-to-usdt",
      "bcv-eur",
    ]);
    expect(result.cards.find((card) => card.id === "bcv-usd")?.value).toBe(
      100.01,
    );
    expect(result.cards.find((card) => card.id === "bcv-to-usdt")?.value).toBe(
      0.81,
    );
    expect(result.cards.find((card) => card.id === "usdt-to-bcv")?.value).toBe(
      1.25,
    );
  });

  it("marks derived rates unavailable when a source fails", async () => {
    const { fetchAllRates } = await importRatesWithMocks({
      binance: { source: "Binance P2P", error: "No P2P SELL ads returned" },
    });

    const result = await fetchAllRates();

    expect(result.exchangeGapPercentage).toBe(0);
    expect(result.cards.find((card) => card.id === "binance-usd")?.value).toBe(
      null,
    );
    expect(result.cards.find((card) => card.id === "binance-usd")?.error).toBe(
      "No P2P SELL ads returned",
    );
    expect(result.cards.find((card) => card.id === "bcv-to-usdt")?.value).toBe(
      null,
    );
    expect(result.cards.find((card) => card.id === "bcv-to-usdt")?.error).toBe(
      "BCV or Binance unavailable",
    );
  });
});
