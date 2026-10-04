import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Rate } from "./types";

const ORIGIN = "https://tasadolar.test";

const bcvUsdSuccess: Rate = {
  price: 100.001,
  updatedAt: "2026-05-25T10:00:00.000Z",
  source: "BCV",
};
const binanceSuccess: Rate = {
  price: 1234.5,
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

async function buildWithMocks({
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
  vi.resetModules();
  vi.doMock("./bcv", () => ({
    fetchDolares: vi.fn().mockResolvedValue({ oficial: bcvUsd, paralelo }),
    fetchBcvEur: vi.fn().mockResolvedValue(bcvEur),
  }));
  vi.doMock("./binance", () => ({
    fetchBinanceP2PRate: vi.fn().mockResolvedValue(binance),
  }));

  const { fetchAllRates } = await import("./rates");
  const { buildAgentRates, formatAgentRatesMarkdown } =
    await import("./agent-rates");
  const feed = buildAgentRates(await fetchAllRates(), ORIGIN);

  return { feed, markdown: formatAgentRatesMarkdown(feed, ORIGIN) };
}

describe("agent rates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T10:03:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock("./bcv");
    vi.doUnmock("./binance");
  });

  it("describes each rate with pair, source and freshness", async () => {
    const { feed } = await buildWithMocks();

    expect(feed.exchangeGapPercentage).toBe(1134.38);
    expect(feed.rates.find((rate) => rate.id === "bcv-usd")).toEqual({
      id: "bcv-usd",
      name: "Dólar BCV",
      url: `${ORIGIN}/bcv/`,
      base: "USD",
      quote: "VES",
      value: 100.01,
      description: "official Banco Central de Venezuela rate",
      source: "BCV",
      updatedAt: "2026-05-25T10:00:00.000Z",
      error: null,
    });

    const usdtToBcv = feed.rates.find((rate) => rate.id === "usdt-to-bcv");
    expect(usdtToBcv?.source).toBe("Binance P2P + BCV");
    expect(usdtToBcv?.updatedAt).toBe("2026-05-25T10:00:00.000Z");
  });

  it("formats numbers with dot decimals and no thousands separator", async () => {
    const { markdown } = await buildWithMocks();

    expect(markdown).toContain(
      `- [USDT Binance](${ORIGIN}/usdt/): 1 USDT = 1234.50 VES (USDT market rate; source: Binance P2P; updated 2026-05-25T10:01:00.000Z)`,
    );
    expect(markdown).toContain(
      "- Exchange gap (USDT over the BCV dollar): 1134.38%",
    );
    expect(markdown).toContain(`- [rates.json](${ORIGIN}/rates.json)`);
  });

  it("reports unavailable rates instead of zeros", async () => {
    const { feed, markdown } = await buildWithMocks({
      binance: { source: "Binance P2P", error: "HTTP 503" },
      paralelo: { source: "Paralelo", error: "HTTP 502" },
    });

    expect(feed.exchangeGapPercentage).toBeNull();
    expect(feed.rates.find((rate) => rate.id === "binance-usd")).toMatchObject({
      value: null,
      updatedAt: null,
      error: "HTTP 503; fallback: HTTP 502",
    });
    expect(feed.rates.find((rate) => rate.id === "bcv-to-usdt")?.error).toBe(
      "BCV or Binance unavailable",
    );
    expect(markdown).toContain("USDT to VES rate unavailable");
    expect(markdown).toContain(
      "- Exchange gap (USDT over the BCV dollar): unavailable",
    );
  });
});
