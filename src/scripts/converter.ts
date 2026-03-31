const SYMBOLS: Record<Tab, string> = { USD: "$", EUR: "€", BS: "Bs." };
const RATE_DECIMALS = 2;
const VALID_TABS = new Set(["USD", "EUR", "BS"] as const);

type Tab = "USD" | "EUR" | "BS";

type RateRowData = {
  id: string;
  currency: Tab;
  baseRate: number;
  displayUnit: "BS" | "USD";
};

function isTab(value: string | undefined): value is Tab {
  return value !== undefined && VALID_TABS.has(value as Tab);
}

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

function readRateRowData(row: HTMLElement): RateRowData | null {
  const { rateRow, currency, baseRate, displayUnit } = row.dataset;
  if (!rateRow || !isTab(currency)) return null;

  const parsedBaseRate = roundUp(parseFloat(baseRate ?? "0"));
  const parsedDisplayUnit = displayUnit === "USD" ? "USD" : "BS";

  return {
    id: rateRow,
    currency,
    baseRate: parsedBaseRate,
    displayUnit: parsedDisplayUnit,
  };
}

function formatRateText(unit: "BS" | "USD", value: number): string {
  const prefix = unit === "USD" ? "$" : "Bs.";
  return `${prefix} ${formatNumber(roundUp(value), RATE_DECIMALS)}`;
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

function setRateText(id: string, text: string): void {
  const valueEl = document.querySelector<HTMLElement>(
    `[data-rate-value="${id}"]`,
  );
  const tooltipEl = document.querySelector<HTMLElement>(
    `[data-rate-tooltip="${id}"]`,
  );

  if (!valueEl) return;
  valueEl.textContent = text;
  valueEl.title = text;
  if (tooltipEl) tooltipEl.textContent = text;
}

function setActiveTabStyles(activeTab: Tab): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-tab]");

  buttons.forEach((button) => {
    const tab = button.dataset.tab;
    const isActive = tab === activeTab;

    button.classList.toggle("bg-teal", isActive);
    button.classList.toggle("text-primary-foreground", isActive);
    button.classList.toggle("text-white/60", !isActive);
  });
}

function initConverter(): void {
  const input = document.getElementById(
    "converter-input",
  ) as HTMLInputElement | null;
  const symbolEl = document.getElementById("converter-symbol");
  const resetButtons = document.querySelectorAll<HTMLButtonElement>(
    "[data-converter-reset]",
  );
  const rows = document.querySelectorAll<HTMLElement>("[data-rate-row]");

  if (!input || !symbolEl || rows.length === 0) return;

  let activeTab: Tab = "USD";

  const getAmount = (): number => {
    const parsed = parseDisplayValue(input.value);
    return isNaN(parsed) || parsed < 0 ? 1 : parsed;
  };

  const updateRates = (): void => {
    const amount = getAmount();

    rows.forEach((row) => {
      const data = readRateRowData(row);
      if (!data) return;

      if (activeTab === "BS") {
        if (data.id === "bcv-to-usdt" || data.id === "usdt-to-bcv") {
          row.style.display = "none";
          return;
        }
        row.style.display = "";
        const converted =
          data.baseRate > 0 ? roundUp(amount / data.baseRate) : 0;
        const unit = data.currency === "EUR" ? "€" : "$";
        setRateText(
          data.id,
          `${unit} ${formatNumber(converted, RATE_DECIMALS)}`,
        );
        return;
      }

      if (data.currency !== activeTab) {
        row.style.display = "none";
        return;
      }

      row.style.display = "";
      setRateText(
        data.id,
        formatRateText(data.displayUnit, amount * data.baseRate),
      );
    });
  };

  const setActiveTab = (tab: Tab): void => {
    activeTab = tab;
    symbolEl.textContent = SYMBOLS[tab];
    setActiveTabStyles(tab);
    updateRates();
  };

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const tabButton = target?.closest<HTMLButtonElement>("[data-tab]");
    if (!tabButton) return;

    const tab = tabButton.dataset.tab;
    if (!isTab(tab)) return;

    setActiveTab(tab);
  });

  input.addEventListener("input", () => {
    const raw = input.value;
    const formatted = sanitizeInput(raw);
    const lengthDiff = formatted.length - raw.length;
    const selectionEnd = (input.selectionEnd ?? raw.length) + lengthDiff;

    input.value = formatted;
    input.setSelectionRange(selectionEnd, selectionEnd);
    updateRates();
  });

  input.addEventListener("blur", () => {
    if (input.value === "") {
      updateRates();
      return;
    }

    const parsed = getAmount();
    if (isNaN(parsed) || parsed < 0) {
      updateRates();
      return;
    }

    const raw = input.value;
    const hasDecimal = raw.includes(",");
    const decimalPlaces = hasDecimal
      ? Math.min(raw.split(",")[1].length, RATE_DECIMALS)
      : 0;

    input.value = formatNumber(parsed, decimalPlaces);
    updateRates();
  });

  resetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      input.value = "";
      input.focus();
      updateRates();
    });
  });

  setActiveTab(activeTab);
}

initConverter();
