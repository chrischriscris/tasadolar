import { describe, expect, it } from "vitest";
import { formatEffectiveDate, formatUpdatedAt } from "./date-format";

describe("formatUpdatedAt", () => {
  it("converts UTC to Caracas time (UTC-4)", () => {
    const text = formatUpdatedAt(new Date("2026-05-25T10:03:00.000Z"));

    expect(text).toContain("25 may");
    expect(text).toContain("6:03");
  });

  it("crosses midnight back to the previous Caracas day", () => {
    const text = formatUpdatedAt(new Date("2026-05-26T02:30:00.000Z"));

    expect(text).toContain("25 may");
    expect(text).toContain("10:30");
  });
});

describe("formatEffectiveDate", () => {
  it("formats the BCV value date in Caracas time", () => {
    const text = formatEffectiveDate("2026-10-02T00:00:00-04:00");

    expect(text).toContain("2 oct");
    expect(text).toContain("vie");
  });
});
