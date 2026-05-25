export type CurrencyTab = "USD" | "EUR" | "BS";
export type DisplayUnit = "BS" | "USD";
export type RateIcon = "bcv" | "us" | "binance" | "eu";

export type RateDefinition = {
  id: string;
  slug: string;
  title: string;
  cardTitle: string;
  inputSymbol: string;
  inputLabel: string;
  icon: RateIcon;
  currency: CurrencyTab;
  displayUnit: DisplayUnit;
  visibleTabs: readonly CurrencyTab[];
};

export const rateDefinitions = [
  {
    id: "bcv-usd",
    slug: "bcv",
    title: "Dólar BCV",
    cardTitle: "Tasa BCV",
    inputSymbol: "$",
    inputLabel: "USD",
    icon: "bcv",
    currency: "USD",
    displayUnit: "BS",
    visibleTabs: ["USD", "BS"],
  },
  {
    id: "binance-usd",
    slug: "usdt",
    title: "USDT Binance",
    cardTitle: "Tasa Binance (USDT)",
    inputSymbol: "$",
    inputLabel: "USDT",
    icon: "binance",
    currency: "USD",
    displayUnit: "BS",
    visibleTabs: ["USD", "BS"],
  },
  {
    id: "usdt-to-bcv",
    slug: "usdt_bcv",
    title: "USDT a BCV",
    cardTitle: "USDT -> BCV",
    inputSymbol: "$",
    inputLabel: "USDT",
    icon: "binance",
    currency: "USD",
    displayUnit: "USD",
    visibleTabs: ["USD"],
  },
  {
    id: "bcv-to-usdt",
    slug: "bcv_usdt",
    title: "BCV a USDT",
    cardTitle: "BCV -> USDT",
    inputSymbol: "$",
    inputLabel: "BCV",
    icon: "bcv",
    currency: "USD",
    displayUnit: "USD",
    visibleTabs: ["USD"],
  },
  {
    id: "bcv-eur",
    slug: "eur",
    title: "Euro BCV",
    cardTitle: "Tasa Euro BCV",
    inputSymbol: "€",
    inputLabel: "EUR",
    icon: "eu",
    currency: "EUR",
    displayUnit: "BS",
    visibleTabs: ["EUR", "BS"],
  },
] as const satisfies readonly RateDefinition[];

export type RateId = (typeof rateDefinitions)[number]["id"];

export function getRateDefinition(id: string): RateDefinition | undefined {
  return rateDefinitions.find((definition) => definition.id === id);
}
