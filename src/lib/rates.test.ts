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
    expect(result.lastUpdatedText).toMatch(/^Actualizado /);
    expect(result.lastUpdatedText).toContain("25 may");
    expect(result.lastUpdatedText).toContain("6:03");
    expect(result.fetchedAt).toBe("2026-05-25T10:03:00.000Z");
    expect(result.cards).toHaveLength(5);
    expect(result.cards.map((card) => card.id)).toEqual([
      "bcv-usd",
      "binance-usd",
      "usdt-to-bcv",
      "bcv-to-usdt",
      "bcv-eur",
    ]);
    const byId = (id: string) => result.cards.find((card) => card.id === id);
    expect(byId("bcv-usd")?.effectiveDate).toBe("2026-05-25T10:00:00.000Z");
    expect(byId("bcv-eur")?.effectiveDate).toBe("2026-05-25T09:00:00.000Z");
    expect(byId("binance-usd")?.effectiveDate).toBeUndefined();
    expect(byId("usdt-to-bcv")?.effectiveDate).toBeUndefined();
    expect(byId("bcv-to-usdt")?.effectiveDate).toBeUndefined();
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

  it("omits the effective date when BCV fails", async () => {
    const { fetchAllRates } = await importRatesWithMocks({
      bcvUsd: { source: "BCV", error: "HTTP 503" },
    });

    const result = await fetchAllRates();
    const byId = (id: string) => result.cards.find((card) => card.id === id);

    expect(byId("bcv-usd")?.effectiveDate).toBeUndefined();
    expect(byId("bcv-eur")?.effectiveDate).toBe("2026-05-25T09:00:00.000Z");
  });

  it("marks derived rates unavailable when a source fails", async () => {
    const { fetchAllRates } = await importRatesWithMocks({
      binance: { source: "Binance P2P", error: "No P2P SELL ads returned" },
    });

    const result = await fetchAllRates();

    expect(result.exchangeGapPercentage).toBeNull();
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

  it("marks the exchange gap unavailable when BCV fails", async () => {
    const { fetchAllRates } = await importRatesWithMocks({
      bcvUsd: { source: "BCV", error: "HTTP 503" },
    });

    const result = await fetchAllRates();

    expect(result.exchangeGapPercentage).toBeNull();
  });

  it("reports no data when every source fails", async () => {
    const { fetchAllRates } = await importRatesWithMocks({
      bcvUsd: { source: "BCV", error: "HTTP 503" },
      binance: { source: "Binance P2P", error: "HTTP 503" },
      bcvEur: { source: "BCV", error: "HTTP 503" },
    });

    const result = await fetchAllRates();

    expect(result.lastUpdatedText).toBe("Sin datos");
  });

  it("uses a successful Binance fallback without disabling derived rates", async () => {
    const { fetchAllRates } = await importRatesWithMocks({
      binance: { ...binanceSuccess, source: "Paralelo" },
    });

    const result = await fetchAllRates();
    const binanceCard = result.cards.find((card) => card.id === "binance-usd");

    expect(binanceCard?.title).toBe("Tasa Binance (USDT)");
    expect(binanceCard?.value).toBe(125);
    expect(result.cards.find((card) => card.id === "usdt-to-bcv")?.value).toBe(
      1.25,
    );
  });
});
