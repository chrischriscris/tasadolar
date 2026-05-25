import { describe, expect, it } from "vitest";

import {
  ceilToDecimals,
  formatNumber,
  parseDisplayNumber,
  sanitizeEditableNumber,
} from "./number-format";

describe("ceilToDecimals", () => {
  it("rounds positive rates up to the requested decimals", () => {
    expect(ceilToDecimals(36.781)).toBe(36.79);
    expect(ceilToDecimals(36.78)).toBe(36.78);
    expect(ceilToDecimals(1.2341, 3)).toBe(1.235);
  });

  it("returns zero for non-finite values", () => {
    expect(ceilToDecimals(Number.NaN)).toBe(0);
    expect(ceilToDecimals(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("formatNumber", () => {
  it("formats values with Spanish Venezuelan separators", () => {
    expect(formatNumber(1234.5)).toBe("1.234,50");
    expect(formatNumber(1234.567, 3)).toBe("1.234,567");
  });
});

describe("parseDisplayNumber", () => {
  it("parses formatted Venezuelan decimal values", () => {
    expect(parseDisplayNumber("1.234,56")).toBe(1234.56);
    expect(parseDisplayNumber("0,50")).toBe(0.5);
  });

  it("rejects empty, negative, or invalid values", () => {
    expect(parseDisplayNumber("")).toBeNull();
    expect(parseDisplayNumber("-1")).toBeNull();
    expect(parseDisplayNumber("abc")).toBeNull();
  });
});

describe("sanitizeEditableNumber", () => {
  it("keeps only a normalized editable decimal number", () => {
    expect(sanitizeEditableNumber("Bs. 001.234,567")).toBe("1234,56");
    expect(sanitizeEditableNumber("...12,,3")).toBe("12,3");
    expect(sanitizeEditableNumber("000")).toBe("0");
  });
});
