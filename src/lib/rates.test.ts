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

const paraleloSuccess: Rate = {
  price: 124,
  updatedAt: "2026-05-25T10:02:00.000Z",
  source: "Paralelo",
};

function createMocks({
  bcvUsd = bcvUsdSuccess,
  paralelo = paraleloSuccess,
  binance = binanceSuccess,
  bcvEur = bcvEurSuccess,
}: {
  bcvUsd?: Rate;
  paralelo?: Rate;
  binance?: Rate;
  bcvEur?: Rate;
} = {}) {
  return {
    fetchDolares: vi.fn().mockResolvedValue({ oficial: bcvUsd, paralelo }),
    fetchBinanceP2PRate: vi.fn().mockResolvedValue(binance),
    fetchBcvEur: vi.fn().mockResolvedValue(bcvEur),
  };
}

async function importRatesWithMocks(
  options: Parameters<typeof createMocks>[0] = {},
) {
  vi.resetModules();
  const mocks = createMocks(options);
  vi.doMock("./bcv", () => ({
    fetchDolares: mocks.fetchDolares,
    fetchBcvEur: mocks.fetchBcvEur,
  }));
  vi.doMock("./binance", () => ({
    fetchBinanceP2PRate: mocks.fetchBinanceP2PRate,
  }));

  const module = await import("./rates");
  return { ...module, mocks };
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
      paralelo: { source: "Paralelo", error: "HTTP 503" },
    });

    const result = await fetchAllRates();

    expect(result.exchangeGapPercentage).toBeNull();
    expect(result.cards.find((card) => card.id === "binance-usd")?.value).toBe(
      null,
    );
    expect(result.cards.find((card) => card.id === "binance-usd")?.error).toBe(
      "No P2P SELL ads returned; fallback: HTTP 503",
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
      paralelo: { source: "Paralelo", error: "HTTP 503" },
      bcvEur: { source: "BCV", error: "HTTP 503" },
    });

    const result = await fetchAllRates();

    expect(result.lastUpdatedText).toBe("Sin datos");
  });

  it("uses a successful Binance fallback without disabling derived rates", async () => {
    const { fetchAllRates, mocks } = await importRatesWithMocks({
      binance: { source: "Binance P2P", error: "HTTP 451" },
    });

    const result = await fetchAllRates();
    const binanceCard = result.cards.find((card) => card.id === "binance-usd");

    expect(binanceCard?.title).toBe("Tasa Binance (USDT)");
    expect(binanceCard?.value).toBe(124);
    expect(result.raw.binance.source).toBe("Paralelo");
    expect(result.cards.find((card) => card.id === "usdt-to-bcv")?.value).toBe(
      1.24,
    );
    expect(mocks.fetchDolares).toHaveBeenCalledTimes(1);
  });

  it("prefers Binance P2P when it succeeds", async () => {
    const { fetchAllRates } = await importRatesWithMocks();

    const result = await fetchAllRates();

    expect(result.raw.binance.source).toBe("Binance P2P");
    expect(result.cards.find((card) => card.id === "binance-usd")?.value).toBe(
      125,
    );
  });
});

describe("fetchAllRates resilience", () => {
  const failedDolares = {
    oficial: { source: "BCV", error: "HTTP 503" },
    paralelo: { source: "Paralelo", error: "HTTP 503" },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T10:03:00.000Z"));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.doUnmock("./bcv");
    vi.doUnmock("./binance");
  });

  it("serves the last good rate when a source starts failing", async () => {
    const { fetchAllRates, mocks } = await importRatesWithMocks();
    await fetchAllRates();

    mocks.fetchDolares.mockResolvedValue(failedDolares);
    vi.setSystemTime(new Date("2026-05-25T10:04:01.000Z"));
    const result = await fetchAllRates();

    expect(result.cards.find((card) => card.id === "bcv-usd")?.value).toBe(
      100.01,
    );
    expect(result.raw.bcvUsd).toMatchObject({ stale: true });
    expect(result.fetchedAt).toBe("2026-05-25T10:03:00.000Z");
  });

  it("drops stale rates after 6 hours", async () => {
    const { fetchAllRates, mocks } = await importRatesWithMocks();
    await fetchAllRates();

    mocks.fetchDolares.mockResolvedValue(failedDolares);
    vi.setSystemTime(new Date("2026-05-25T17:04:00.000Z"));
    const result = await fetchAllRates();

    expect(
      result.cards.find((card) => card.id === "bcv-usd")?.value,
    ).toBeNull();
  });

  it("retries sooner after an error", async () => {
    const { fetchAllRates, mocks } = await importRatesWithMocks({
      binance: { source: "Binance P2P", error: "HTTP 503" },
      paralelo: { source: "Paralelo", error: "HTTP 503" },
    });

    await fetchAllRates();
    vi.setSystemTime(new Date("2026-05-25T10:03:16.000Z"));
    await fetchAllRates();

    expect(mocks.fetchBinanceP2PRate).toHaveBeenCalledTimes(2);
  });

  it("keeps the normal cache when everything succeeds", async () => {
    const { fetchAllRates, mocks } = await importRatesWithMocks();

    await fetchAllRates();
    vi.setSystemTime(new Date("2026-05-25T10:03:30.000Z"));
    await fetchAllRates();

    expect(mocks.fetchBinanceP2PRate).toHaveBeenCalledTimes(1);
  });
});
