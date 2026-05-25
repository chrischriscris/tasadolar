import {
  ceilToDecimals,
  formatNumber,
  parseDisplayNumber,
  RATE_DECIMALS,
  sanitizeEditableNumber,
} from "@/lib/number-format";

type RateRowData = {
  id: string;
  baseRate: number;
  displayUnit: "BS" | "USD";
  available: boolean;
};

function readRateRowData(row: HTMLElement): RateRowData | null {
  const { rateRow, baseRate, displayUnit, rateAvailable } = row.dataset;
  if (!rateRow) return null;

  return {
    id: rateRow,
    baseRate: ceilToDecimals(parseFloat(baseRate ?? "0")),
    displayUnit: displayUnit === "USD" ? "USD" : "BS",
    available: rateAvailable !== "false",
  };
}

function initSingleRateConverter(): void {
  const input = document.getElementById(
    "converter-input",
  ) as HTMLInputElement | null;
  const row = document.querySelector<HTMLElement>("[data-rate-row]");
  const resetButton = document.querySelector<HTMLButtonElement>(
    "[data-converter-reset]",
  );

  if (!input || !row) return;

  const data = readRateRowData(row);
  const valueEl = data
    ? document.querySelector<HTMLElement>(`[data-rate-value="${data.id}"]`)
    : null;
  const tooltipEl = data
    ? document.querySelector<HTMLElement>(`[data-rate-tooltip="${data.id}"]`)
    : null;

  if (!data || !valueEl) return;

  const renderRate = (): void => {
    if (!data.available || data.baseRate <= 0) {
      valueEl.textContent = "No disponible";
      return;
    }

    const amount = parseDisplayNumber(input.value) ?? 1;
    const prefix = data.displayUnit === "USD" ? "$" : "Bs.";
    const text = `${prefix} ${formatNumber(
      ceilToDecimals(amount * data.baseRate),
      RATE_DECIMALS,
    )}`;

    valueEl.textContent = text;
    valueEl.title = text;
    valueEl.setAttribute("aria-label", text);
    if (tooltipEl) tooltipEl.textContent = text;
  };

  input.addEventListener("input", () => {
    const raw = input.value;
    const text = sanitizeEditableNumber(raw, RATE_DECIMALS);
    const lengthDiff = text.length - raw.length;
    const selectionEnd = Math.max(
      0,
      (input.selectionEnd ?? raw.length) + lengthDiff,
    );

    input.value = text;
    input.setSelectionRange(selectionEnd, selectionEnd);
    renderRate();
  });

  input.addEventListener("blur", () => {
    const amount = parseDisplayNumber(input.value);
    if (amount !== null) input.value = formatNumber(amount, RATE_DECIMALS);
    renderRate();
  });

  input.addEventListener("focus", () => {
    input.value = "";
    renderRate();
  });

  resetButton?.addEventListener("click", () => {
    input.value = "";
    input.focus();
    renderRate();
  });

  renderRate();
}

initSingleRateConverter();
