import {
  formatNumber,
  parseDisplayNumber,
  RATE_DECIMALS,
  roundUp,
  sanitizeEditableNumber,
} from "@/lib/number-format";

const SYMBOLS: Record<Tab, string> = { USD: "$", EUR: "€", BS: "Bs." };
const VALID_TABS = new Set(["USD", "EUR", "BS"] as const);

type Tab = "USD" | "EUR" | "BS";

type RateRowData = {
  id: string;
  currency: Tab;
  baseRate: number;
  displayUnit: "BS" | "USD";
};

type ConverterState = {
  activeTab: Tab;
  amount: number | null;
  inputText: string;
  inputFocused: boolean;
};

function isTab(value: string | undefined): value is Tab {
  return value !== undefined && VALID_TABS.has(value as Tab);
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
  valueEl.setAttribute("aria-label", text);
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

  const rateRows = Array.from(rows)
    .map((row) => ({ element: row, data: readRateRowData(row) }))
    .filter(
      (row): row is { element: HTMLElement; data: RateRowData } =>
        row.data !== null,
    );
  const state: ConverterState = {
    activeTab: "USD",
    amount: null,
    inputText: "",
    inputFocused: document.activeElement === input,
  };

  const updateRates = (): void => {
    const amount = state.amount ?? 1;

    rateRows.forEach(({ element, data }) => {
      if (state.activeTab === "BS") {
        if (data.id === "bcv-to-usdt" || data.id === "usdt-to-bcv") {
          element.style.display = "none";
          return;
        }
        element.style.display = "";
        const converted =
          data.baseRate > 0 ? roundUp(amount / data.baseRate) : 0;
        const unit = data.currency === "EUR" ? "€" : "$";
        setRateText(
          data.id,
          `${unit} ${formatNumber(converted, RATE_DECIMALS)}`,
        );
        return;
      }

      if (data.currency !== state.activeTab) {
        element.style.display = "none";
        return;
      }

      element.style.display = "";
      setRateText(
        data.id,
        formatRateText(data.displayUnit, amount * data.baseRate),
      );
    });
  };

  const renderInput = (): void => {
    const nextValue = state.inputFocused
      ? state.inputText
      : state.amount === null
        ? ""
        : formatNumber(state.amount, RATE_DECIMALS);

    if (input.value !== nextValue) input.value = nextValue;
  };

  const render = (): void => {
    symbolEl.textContent = SYMBOLS[state.activeTab];
    setActiveTabStyles(state.activeTab);
    renderInput();
    updateRates();
  };

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const tabButton = target?.closest<HTMLButtonElement>("[data-tab]");
    if (!tabButton) return;

    const tab = tabButton.dataset.tab;
    if (!isTab(tab)) return;

    state.activeTab = tab;
    render();
  });

  input.addEventListener("input", () => {
    const raw = input.value;
    const text = sanitizeEditableNumber(raw, RATE_DECIMALS);
    const lengthDiff = text.length - raw.length;
    const selectionEnd = Math.max(
      0,
      (input.selectionEnd ?? raw.length) + lengthDiff,
    );

    state.inputText = text;
    state.amount = parseDisplayNumber(text);
    input.value = text;
    input.setSelectionRange(selectionEnd, selectionEnd);
    render();
  });

  input.addEventListener("focus", () => {
    state.inputFocused = true;
    state.inputText =
      state.amount === null ? "" : sanitizeEditableNumber(input.value);
    render();
  });

  input.addEventListener("blur", () => {
    state.inputFocused = false;
    state.amount = parseDisplayNumber(state.inputText);
    render();
  });

  resetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.amount = null;
      state.inputText = "";
      state.inputFocused = true;
      input.focus();
      render();
    });
  });

  render();
}

initConverter();
