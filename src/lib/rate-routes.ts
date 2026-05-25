export type RateRoute = {
  slug: string;
  id: string;
  title: string;
  inputSymbol: string;
  inputLabel: string;
};

export const rateRoutes = [
  {
    slug: "bcv",
    id: "bcv-usd",
    title: "Dólar BCV",
    inputSymbol: "$",
    inputLabel: "USD",
  },
  {
    slug: "usdt",
    id: "binance-usd",
    title: "USDT Binance",
    inputSymbol: "$",
    inputLabel: "USDT",
  },
  {
    slug: "usdt_bcv",
    id: "usdt-to-bcv",
    title: "USDT a BCV",
    inputSymbol: "$",
    inputLabel: "USDT",
  },
  {
    slug: "bcv_usdt",
    id: "bcv-to-usdt",
    title: "BCV a USDT",
    inputSymbol: "$",
    inputLabel: "BCV",
  },
  {
    slug: "eur",
    id: "bcv-eur",
    title: "Euro BCV",
    inputSymbol: "€",
    inputLabel: "EUR",
  },
] as const satisfies readonly RateRoute[];
