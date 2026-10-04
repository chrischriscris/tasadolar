// ---------------------------------------------------------------------------
// agent-rates.ts – Rates for AI agents and scripts (/llms.txt, /rates.json)
//
// Unlike the UI, values use dot decimals, explicit currency pairs and ISO
// timestamps, so agents don't misread es-VE formatting ("1.234,56").
// ---------------------------------------------------------------------------

import type { AllRates } from "./rates";
import { getRateDefinition, type RateId } from "./rate-definitions";
import { RATE_DECIMALS } from "./number-format";

type RawSource = keyof AllRates["raw"];

type AgentRateDefinition = {
  base: string;
  quote: string;
  description: string;
  /** Sources the rate is computed from */
  inputs: RawSource[];
};

const agentRateDefinitions = {
  "bcv-usd": {
    base: "USD",
    quote: "VES",
    description: "official Banco Central de Venezuela rate",
    inputs: ["bcvUsd"],
  },
  "binance-usd": {
    base: "USDT",
    quote: "VES",
    description: "USDT market rate",
    inputs: ["binance"],
  },
  "usdt-to-bcv": {
    base: "USDT",
    quote: "USD",
    description: "USD at the BCV rate obtained by selling 1 USDT for bolívares",
    inputs: ["binance", "bcvUsd"],
  },
  "bcv-to-usdt": {
    base: "USD",
    quote: "USDT",
    description: "USDT bought with the bolívares worth 1 USD at the BCV rate",
    inputs: ["bcvUsd", "binance"],
  },
  "bcv-eur": {
    base: "EUR",
    quote: "VES",
    description: "official Banco Central de Venezuela rate",
    inputs: ["bcvEur"],
  },
} satisfies Record<RateId, AgentRateDefinition>;

export interface AgentRate {
  id: RateId;
  name: string;
  url: string;
  base: string;
  quote: string;
  /** Units of `quote` per 1 `base`; null when unavailable */
  value: number | null;
  description: string;
  source: string;
  updatedAt: string | null;
  error: string | null;
}

export interface AgentRates {
  rates: AgentRate[];
  /** USDT premium over the BCV dollar, in percent */
  exchangeGapPercentage: number | null;
}

/** A derived rate is only as fresh as its oldest input */
function oldestUpdatedAt(data: AllRates, inputs: RawSource[]): string | null {
  let oldest: string | null = null;
  for (const input of inputs) {
    const { updatedAt } = data.raw[input];
    if (!updatedAt) return null;
    if (!oldest || Date.parse(updatedAt) < Date.parse(oldest))
      oldest = updatedAt;
  }
  return oldest;
}

export function buildAgentRates(data: AllRates, origin: string): AgentRates {
  const rates = data.cards.map((card): AgentRate => {
    const { base, quote, description, inputs } = agentRateDefinitions[card.id];
    const value = card.value;

    return {
      id: card.id,
      name: getRateDefinition(card.id)?.title ?? card.title,
      url: new URL(card.href ?? "/", origin).href,
      base,
      quote,
      value,
      description,
      source: inputs.map((input) => data.raw[input].source).join(" + "),
      updatedAt: value === null ? null : oldestUpdatedAt(data, inputs),
      error: value === null ? (card.error ?? "Unavailable") : null,
    };
  });

  const valueOf = (id: RateId) =>
    rates.find((rate) => rate.id === id)?.value ?? null;

  return {
    rates,
    exchangeGapPercentage:
      valueOf("bcv-usd") === null || valueOf("binance-usd") === null
        ? null
        : data.exchangeGapPercentage,
  };
}

function formatRateLine(rate: AgentRate): string {
  const value =
    rate.value === null
      ? `${rate.base} to ${rate.quote} rate unavailable`
      : `1 ${rate.base} = ${rate.value.toFixed(RATE_DECIMALS)} ${rate.quote}`;
  const details = [
    rate.description,
    `source: ${rate.source}`,
    rate.updatedAt && `updated ${rate.updatedAt}`,
  ]
    .filter(Boolean)
    .join("; ");

  return `- [${rate.name}](${rate.url}): ${value} (${details})`;
}

/** Markdown following the llms.txt convention (https://llmstxt.org) */
export function formatAgentRatesMarkdown(
  feed: AgentRates,
  origin: string,
): string {
  const gap =
    feed.exchangeGapPercentage === null
      ? "unavailable"
      : `${feed.exchangeGapPercentage.toFixed(2)}%`;

  return [
    "# TasaDolar",
    "",
    "> Venezuelan bolívar (VES) exchange rates: the official BCV dollar and euro, and the USDT market rate.",
    "",
    "Numbers use a dot as the decimal separator and no thousands separator. Timestamps are ISO 8601 as reported by each source. Values are cached for up to 60 seconds.",
    "",
    "## Current rates",
    "",
    ...feed.rates.map(formatRateLine),
    `- Exchange gap (USDT over the BCV dollar): ${gap}`,
    "",
    "## Data",
    "",
    `- [rates.json](${new URL("/rates.json", origin).href}): the same rates as JSON`,
    `- [TasaDolar](${new URL("/", origin).href}): converter for USD, USDT, EUR and bolívares`,
    "",
  ].join("\n");
}
