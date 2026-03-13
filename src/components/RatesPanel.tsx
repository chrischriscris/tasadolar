import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Undo2 } from "lucide-react";
import type { RateCardData } from "@/lib/rates";

type Tab = "USD" | "EUR" | "BS";

type Props = {
  cards: RateCardData[];
  exchangeGapPercentage: number;
  lastUpdatedText: string;
};

const SYMBOLS: Record<Tab, string> = { USD: "$", EUR: "€", BS: "Bs." };
const RATE_DECIMALS = 2;

function roundUp(value: number, decimals = RATE_DECIMALS): number {
  if (!isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.ceil(value * factor) / factor;
}

function formatNumber(value: number, decimals: number): string {
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function parseDisplayValue(str: string): number {
  const normalized = str.replace(/\./g, "").replace(",", ".");
  return parseFloat(normalized);
}

function sanitizeInput(raw: string): string {
  let cleaned = raw.replace(/[^0-9,]/g, "");
  const commaIndex = cleaned.indexOf(",");
  if (commaIndex !== -1) {
    cleaned =
      cleaned.slice(0, commaIndex + 1) +
      cleaned.slice(commaIndex + 1).replace(/,/g, "");
  }

  const [intPart, decPartRaw] = cleaned.split(",");
  const decPart = decPartRaw ? decPartRaw.slice(0, RATE_DECIMALS) : undefined;
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return decPart !== undefined ? `${formattedInt},${decPart}` : formattedInt;
}

function getAmount(inputValue: string): number {
  const parsed = parseDisplayValue(inputValue);
  return isNaN(parsed) || parsed < 0 ? 1 : parsed;
}

function getIconUrl(iconType: RateCardData["icon"]): string {
  switch (iconType) {
    case "bcv":
      return "https://flagcdn.com/w80/ve.png";
    case "us":
      return "https://flagcdn.com/w80/us.png";
    case "binance":
      return "https://public.bnbstatic.com/20190405/eb2349c3-b2f8-4a93-a286-8f86a62ea9d8.png";
    case "eu":
      return "https://flagcdn.com/w80/eu.png";
    default:
      return "";
  }
}

function formatRateValue(
  rate: RateCardData,
  amount: number,
  activeTab: Tab,
): string {
  if (activeTab === "BS") {
    const converted = rate.value > 0 ? roundUp(amount / rate.value) : 0;
    const prefix = rate.currency === "EUR" ? "€" : "$";
    return `${prefix} ${formatNumber(converted, RATE_DECIMALS)}`;
  }

  const converted = roundUp(amount * rate.value);
  const prefix = rate.displayUnit === "USD" ? "$" : "Bs.";
  return `${prefix} ${formatNumber(converted, RATE_DECIMALS)}`;
}

export default function RatesPanel({
  cards,
  exchangeGapPercentage,
  lastUpdatedText,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("USD");
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const amount = useMemo(() => getAmount(inputValue), [inputValue]);
  const visibleCards = useMemo(
    () =>
      activeTab === "BS"
        ? cards
        : cards.filter((card) => card.currency === activeTab),
    [cards, activeTab],
  );

  const isPositiveGap = exchangeGapPercentage >= 0;
  const gapDelta = `${isPositiveGap ? "+" : ""}${exchangeGapPercentage.toFixed(2)}%`;

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    setInputValue(sanitizeInput(event.target.value));
  };

  const handleBlur = () => {
    if (inputValue === "") return;

    const parsed = getAmount(inputValue);
    if (isNaN(parsed) || parsed < 0) return;

    const hasDecimal = inputValue.includes(",");
    const decimalPlaces = hasDecimal
      ? Math.min(inputValue.split(",")[1].length, RATE_DECIMALS)
      : 0;
    setInputValue(formatNumber(parsed, decimalPlaces));
  };

  const handleReset = () => {
    setInputValue("");
    inputRef.current?.focus();
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
      <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Tasas de Referencia</h2>
          <span className="text-sm text-white/50">{lastUpdatedText}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div id="rates-list" className="flex flex-col gap-3">
            {visibleCards.map((rate) => {
              const valueText = formatRateValue(rate, amount, activeTab);
              const iconUrl = getIconUrl(rate.icon);

              return (
                <div
                  key={rate.id}
                  className="group bg-card hover:bg-card/80 flex items-center gap-4 rounded-2xl p-3 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                    <img
                      src={iconUrl}
                      alt={rate.icon}
                      className="h-8 w-8 rounded-xl object-cover"
                    />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-xs font-medium text-white/80">
                      {rate.title}
                    </span>
                    <div className="relative">
                      <span
                        className="text-teal peer block truncate text-xl font-bold"
                        tabIndex={0}
                        aria-label={valueText}
                        title={valueText}
                      >
                        {valueText}
                      </span>
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-0 z-10 w-max max-w-52 rounded-md bg-black/90 px-2 py-1 text-[11px] font-medium tracking-normal text-white/90 opacity-0 transition-opacity duration-150 peer-hover:opacity-100 peer-focus:opacity-100"
                      >
                        {valueText}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-auto mb-4 flex flex-col gap-3">
        <div className="mx-auto flex w-fit items-center justify-center gap-2 text-center">
          <p className="text-xs font-medium tracking-[0.12em] text-white/45">
            BRECHA CAMBIARIA
          </p>
          <span className="group relative inline-flex">
            <span
              tabIndex={0}
              aria-label={gapDelta}
              className={`shrink-0 cursor-help rounded-md px-2 py-1 text-xs font-medium ${
                isPositiveGap
                  ? "bg-positive/10 text-positive/75"
                  : "bg-negative/10 text-negative/75"
              }`}
            >
              {exchangeGapPercentage.toFixed(2)}%
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-10 w-max max-w-52 -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-left text-[11px] font-medium tracking-normal text-white/90 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
            >
              Diferencia entre BCV y USDT ({gapDelta})
            </span>
          </span>
        </div>

        <div className="bg-card ml-auto inline-grid grid-cols-3 rounded-xl p-1">
          {(["USD", "EUR", "BS"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`min-w-20 rounded-lg px-6 py-1 text-sm font-semibold transition-all ${
                activeTab === tab
                  ? "bg-teal text-primary-foreground"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="bg-card flex items-center rounded-2xl p-3">
          <span
            id="converter-symbol"
            className="pr-3 text-xl font-light text-white/60"
          >
            {SYMBOLS[activeTab]}
          </span>
          <div className="min-w-0 flex-1 overflow-hidden">
            <input
              ref={inputRef}
              id="converter-input"
              type="text"
              inputMode="decimal"
              placeholder="1.00"
              autoFocus
              value={inputValue}
              onChange={handleInput}
              onBlur={handleBlur}
              className="w-full min-w-0 bg-transparent text-xl font-bold text-white outline-none placeholder:text-white/30"
            />
          </div>
          <span aria-hidden="true" className="h-5 w-px bg-white/20"></span>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full p-1.5 text-white/60 transition-colors hover:text-white"
            aria-label="Revertir monto"
            title="Revertir"
          >
            <Undo2 size={16} aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  );
}
