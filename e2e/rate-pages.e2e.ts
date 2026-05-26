import { expect, test } from "@playwright/test";
import { rateDefinitions } from "../src/lib/rate-definitions";

test.describe("rate pages", () => {
  for (const { id, slug } of rateDefinitions) {
    test(`/${slug}/ matches the homepage rate for ${id}`, async ({ page }) => {
      await page.goto("/");

      const homepageRate = page.locator(`[data-rate-row="${id}"]`);
      await expect(homepageRate).toHaveAttribute("data-rate-available", "true");
      const homepageValue = await homepageRate.getAttribute("data-base-rate");

      await page.goto(`/${slug}/`);

      const ratePageRate = page.locator(`[data-rate-row="${id}"]`);
      await expect(ratePageRate).toHaveAttribute("data-rate-available", "true");
      await expect(ratePageRate).toHaveAttribute(
        "data-base-rate",
        homepageValue ?? "",
      );
    });
  }
});
