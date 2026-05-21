import {
  formatNumber,
  ceilToDecimals,
  parseDisplayNumber,
  RATE_DECIMALS,
  sanitizeEditableNumber,
} from "@/lib/number-format";

const SYMBOLS: Record<Tab, string> = { USD: "$", EUR: "€", BS: "Bs." };
const VALID_TABS = new Set(["USD", "EUR", "BS"] as const);
const STORAGE_KEY = "tasadolar:converter";

type Tab = "USD" | "EUR" | "BS";

type RateRowData = {
  id: string;
  currency: Tab;
  baseRate: number;
  displayUnit: "BS" | "USD";
  available: boolean;
};

type RateRow = {
  element: HTMLElement;
  valueEl: HTMLElement;
  tooltipEl: HTMLElement | null;
  data: RateRowData;
};

type ConverterState = {
  activeTab: Tab;
  amount: number | null;
  inputText: string;
  inputFocused: boolean;
};

type StoredConverterState = {
  activeTab?: string;
  inputText?: string;
};

function isTab(value: string | undefined): value is Tab {
  return value !== undefined && VALID_TABS.has(value as Tab);
}

function readRateRowData(row: HTMLElement): RateRowData | null {
  const { rateRow, currency, baseRate, displayUnit, rateAvailable } =
    row.dataset;
  if (!rateRow || !isTab(currency)) return null;

  const parsedBaseRate = ceilToDecimals(parseFloat(baseRate ?? "0"));
  const parsedDisplayUnit = displayUnit === "USD" ? "USD" : "BS";

  return {
    id: rateRow,
    currency,
    baseRate: parsedBaseRate,
    displayUnit: parsedDisplayUnit,
    available: rateAvailable !== "false" && parsedBaseRate > 0,
  };
}

function formatRateText(unit: "BS" | "USD", value: number): string {
  const prefix = unit === "USD" ? "$" : "Bs.";
  return `${prefix} ${formatNumber(ceilToDecimals(value), RATE_DECIMALS)}`;
}

function readRateRow(row: HTMLElement): RateRow | null {
  const data = readRateRowData(row);
  if (!data) return null;

  const valueEl = document.querySelector<HTMLElement>(
    `[data-rate-value="${data.id}"]`,
  );
  if (!valueEl) return null;

  return {
    element: row,
    valueEl,
    tooltipEl: document.querySelector<HTMLElement>(
      `[data-rate-tooltip="${data.id}"]`,
    ),
    data,
  };
}

function setRateText(row: RateRow, text: string): void {
  const { valueEl, tooltipEl } = row;
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

function loadStoredState(): Pick<
  ConverterState,
  "activeTab" | "amount" | "inputText"
> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { activeTab: "USD", amount: null, inputText: "" };

    const parsed = JSON.parse(stored) as StoredConverterState;
    const inputText = sanitizeEditableNumber(
      parsed.inputText ?? "",
      RATE_DECIMALS,
    );

    return {
      activeTab: isTab(parsed.activeTab) ? parsed.activeTab : "USD",
      amount: parseDisplayNumber(inputText),
      inputText,
    };
  } catch {
    return { activeTab: "USD", amount: null, inputText: "" };
  }
}

function saveState(state: ConverterState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeTab: state.activeTab,
        inputText: state.inputText,
      } satisfies StoredConverterState),
    );
  } catch {
    // Ignore storage failures in private mode or restricted webviews.
  }
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
    .map(readRateRow)
    .filter((row): row is RateRow => row !== null);
  const storedState = loadStoredState();
  const state: ConverterState = {
    ...storedState,
    inputFocused: document.activeElement === input,
  };

  const updateRates = (): void => {
    const amount = state.amount ?? 1;

    rateRows.forEach((row) => {
      const { element, data } = row;
      if (state.activeTab === "BS") {
        if (data.id === "bcv-to-usdt" || data.id === "usdt-to-bcv") {
          element.style.display = "none";
          return;
        }
        element.style.display = "";
        if (!data.available) {
          setRateText(row, "No disponible");
          return;
        }
        const converted =
          data.baseRate > 0 ? ceilToDecimals(amount / data.baseRate) : 0;
        const unit = data.currency === "EUR" ? "€" : "$";
        setRateText(row, `${unit} ${formatNumber(converted, RATE_DECIMALS)}`);
        return;
      }

      if (data.currency !== state.activeTab) {
        element.style.display = "none";
        return;
      }

      element.style.display = "";
      if (!data.available) {
        setRateText(row, "No disponible");
        return;
      }
      setRateText(
        row,
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
    saveState(state);
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
    saveState(state);
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
    saveState(state);
    render();
  });

  resetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.amount = null;
      state.inputText = "";
      state.inputFocused = true;
      input.focus();
      saveState(state);
      render();
    });
  });

  render();
}

initConverter();
