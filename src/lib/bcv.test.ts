import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBcvEur, fetchDolares } from "./bcv";

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

const dolaresBody = [
  {
    moneda: "USD",
    fuente: "oficial",
    nombre: "Dólar",
    compra: null,
    venta: null,
    promedio: 866.5612,
    fechaActualizacion: "2026-10-02T00:00:00-04:00",
  },
  {
    moneda: "USD",
    fuente: "paralelo",
    nombre: "Paralelo",
    compra: null,
    venta: null,
    promedio: 974.490264,
    fechaActualizacion: "2026-10-04T15:00:59.285Z",
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

  it("fetches dolares once and parses both entries", async () => {
    const fetchMock = respondWith(dolaresBody);
    vi.stubGlobal("fetch", fetchMock);

    const { oficial, paralelo } = await fetchDolares();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(oficial).toEqual({
      price: 866.5612,
      updatedAt: "2026-10-02T00:00:00-04:00",
      source: "BCV",
    });
    expect(paralelo).toEqual({
      price: 974.490264,
      updatedAt: "2026-10-04T15:00:59.285Z",
      source: "Paralelo",
    });
  });

  it("keeps oficial when the paralelo entry is missing", async () => {
    vi.stubGlobal("fetch", respondWith([dolaresBody[0]]));

    const { oficial, paralelo } = await fetchDolares();

    expect(paralelo.error).toContain("No 'paralelo' entry");
    expect(oficial.price).toBe(866.5612);
  });

  it("keeps paralelo when the oficial value is invalid", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith([{ ...dolaresBody[0], promedio: 0 }, dolaresBody[1]]),
    );

    const { oficial, paralelo } = await fetchDolares();

    expect(oficial.error).toContain("Invalid rate value");
    expect(paralelo.error).toBeUndefined();
  });

  it("fails both rates on an HTTP error", async () => {
    vi.stubGlobal("fetch", respondWith({}, 503));

    const { oficial, paralelo } = await fetchDolares();

    expect(oficial.error).toBe("HTTP 503");
    expect(paralelo.error).toBe("HTTP 503");
  });

  // No body-timeout test: a mocked Response body is not tied to the abort
  // signal, so a test cannot observe that fix. Covered by code review.
});
