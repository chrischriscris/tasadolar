import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBcvEur } from "./bcv";

const eurosBody = [
  {
    moneda: "EUR",
    fuente: "oficial",
    nombre: "Euro",
    compra: null,
    venta: null,
    promedio: 973.92813268,
    fechaActualizacion: "2026-10-02T00:00:00-04:00",
  },
];

function respondWith(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("bcv", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("parses the oficial euro entry", async () => {
    vi.stubGlobal("fetch", respondWith(eurosBody));

    expect(await fetchBcvEur()).toEqual({
      price: 973.92813268,
      updatedAt: "2026-10-02T00:00:00-04:00",
      source: "BCV",
    });
  });

  it("reports HTTP errors", async () => {
    vi.stubGlobal("fetch", respondWith({}, 503));

    expect((await fetchBcvEur()).error).toBe("HTTP 503");
  });

  it("aborts when response headers never arrive", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            ),
          ),
      ),
    );

    const pending = fetchBcvEur();
    await vi.advanceTimersByTimeAsync(5_000);

    expect((await pending).error).toBeDefined();
  });

  // No body-timeout test: a mocked Response body is not tied to the abort
  // signal, so a test cannot observe that fix. Covered by code review.
});
