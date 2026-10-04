import { expect, test } from "@playwright/test";

const tabRates = {
  USD: ["bcv-usd", "binance-usd", "usdt-to-bcv", "bcv-to-usdt"],
  EUR: ["bcv-eur"],
  BS: ["bcv-usd", "binance-usd", "bcv-eur"],
} as const;

const allRateIds = [
  "bcv-usd",
  "binance-usd",
  "usdt-to-bcv",
  "bcv-to-usdt",
  "bcv-eur",
] as const;

const routeRates = [
  { slug: "bcv", id: "bcv-usd", title: "Dólar BCV" },
  { slug: "usdt", id: "binance-usd", title: "USDT Binance" },
  { slug: "usdt_bcv", id: "usdt-to-bcv", title: "USDT a BCV" },
  { slug: "bcv_usdt", id: "bcv-to-usdt", title: "BCV a USDT" },
  { slug: "eur", id: "bcv-eur", title: "Euro BCV" },
] as const;

test.describe("home rate tabs", () => {
  for (const [tab, visibleIds] of Object.entries(tabRates)) {
    test(`${tab} tab shows only its rates`, async ({ page }) => {
      const visibleRateIds = new Set<string>(visibleIds);
      await page.goto("/");
      await page.getByRole("button", { name: tab }).click();

      await expect(page.locator("html")).toHaveAttribute(
        "data-active-tab",
        tab,
      );

      for (const id of allRateIds) {
        const row = page.locator(`[data-rate-row="${id}"]`);
        if (visibleRateIds.has(id)) {
          await expect(row).toBeVisible();
        } else {
          await expect(row).toBeHidden();
        }
      }
    });
  }
});

test.describe("rate routes", () => {
  for (const { slug, id, title } of routeRates) {
    test(`/${slug} shows ${title}`, async ({ page }) => {
      await page.goto(`/${slug}`);

      await expect(page.getByRole("heading", { name: title })).toBeVisible();
      await expect(page.locator("[data-rate-row]")).toHaveCount(1);
      await expect(page.locator(`[data-rate-row="${id}"]`)).toBeVisible();
    });
  }
});

test.describe("exchange gap", () => {
  test("shows an es-VE percentage, or 'No disponible' when a rate is missing", async ({
    page,
  }) => {
    await page.goto("/");

    const bcvAvailable = await page
      .locator('[data-rate-row="bcv-usd"]')
      .getAttribute("data-rate-available");
    const usdtAvailable = await page
      .locator('[data-rate-row="binance-usd"]')
      .getAttribute("data-rate-available");
    const gapText = (
      await page.locator("[data-exchange-gap]").textContent()
    )?.trim();

    if (bcvAvailable === "true" && usdtAvailable === "true") {
      expect(gapText).toMatch(/^-?\d{1,3}(\.\d{3})*,\d{2}%$/);
    } else {
      expect(gapText).toBe("No disponible");
    }
  });
});
