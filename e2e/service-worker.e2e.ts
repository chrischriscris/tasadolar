import { expect, test, type Page } from "@playwright/test";

const ratePagePaths = ["/bcv/", "/usdt/", "/usdt_bcv/", "/bcv_usdt/", "/eur/"];

async function cachedUrls(page: Page) {
  return page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) urls.push(request.url);
    }
    return urls;
  });
}

test.describe("service worker cache", () => {
  test("caches only page assets with valid URLs", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    await expect
      .poll(async () =>
        (await cachedUrls(page)).some((url) => url.includes("/_astro/")),
      )
      .toBe(true);

    const urls = (await cachedUrls(page)).map((url) => new URL(url));
    const paths = urls.map((url) => url.pathname);

    expect(paths).toContain("/");
    expect(paths.filter((path) => path.startsWith("/splash/"))).toEqual([]);
    expect(paths.filter((path) => ratePagePaths.includes(path))).toEqual([]);
    expect(urls.filter((url) => url.search.includes("amp;"))).toEqual([]);
    for (const url of urls.filter((url) => url.pathname === "/_image")) {
      expect(url.searchParams.get("f")).not.toBeNull();
    }
  });
});
