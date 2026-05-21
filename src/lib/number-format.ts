export const RATE_DECIMALS = 2;

export function roundUp(value: number, decimals = RATE_DECIMALS): number {
  if (!isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.ceil(value * factor) / factor;
}

export function formatNumber(value: number, decimals = RATE_DECIMALS): string {
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function parseDisplayNumber(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (normalized === "") return null;

  const parsed = Number(normalized);
  return isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function sanitizeEditableNumber(
  value: string,
  decimals = RATE_DECIMALS,
): string {
  const cleaned = value.replace(/[^0-9.,]/g, "");
  const lastSeparatorIndex = Math.max(
    cleaned.lastIndexOf(","),
    cleaned.lastIndexOf("."),
  );

  const integerRaw =
    lastSeparatorIndex === -1 ? cleaned : cleaned.slice(0, lastSeparatorIndex);
  const decimalRaw =
    lastSeparatorIndex === -1 ? "" : cleaned.slice(lastSeparatorIndex + 1);
  const integer = integerRaw.replace(/[.,]/g, "");
  const decimal = decimalRaw.replace(/[.,]/g, "").slice(0, decimals);

  if (lastSeparatorIndex === -1) return integer;
  return `${integer},${decimal}`;
}
