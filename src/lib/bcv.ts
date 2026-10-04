// ---------------------------------------------------------------------------
// BCV (Banco Central de Venezuela) – Dólar y Euro oficial
// Source: ve.dolarapi.com (wrapper around BCV data)
//
// Endpoints used:
//   - https://ve.dolarapi.com/v1/dolares  → [{ fuente: "oficial", promedio, ... }]
//                                           (also the fuente: "paralelo" entry)
//   - https://ve.dolarapi.com/v1/euros    → [{ fuente: "oficial", promedio, ... }]
//
// TODO: Consider adding retry logic
// TODO: Consider adding fallback URLs
// ---------------------------------------------------------------------------

import type { Rate, DolarApiResponse } from "./types";

const DOLARES_URL = "https://ve.dolarapi.com/v1/dolares";
const EUROS_URL = "https://ve.dolarapi.com/v1/euros";
const TIMEOUT_MS = 5_000;

async function fetchWithTimeout(url: string): Promise<DolarApiResponse[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function pickByFuente(
  data: DolarApiResponse[],
  fuente: string,
): DolarApiResponse | undefined {
  return data.find((d) => d.fuente === fuente);
}

function readValidPrice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid rate value: ${value}`);
  }
  return value;
}

function readDolarEntry(
  data: DolarApiResponse[],
  fuente: "oficial" | "paralelo",
  source: string,
): Rate {
  try {
    const entry = pickByFuente(data, fuente);
    if (!entry) throw new Error(`No '${fuente}' entry in dolares response`);
    return {
      price: readValidPrice(entry.promedio),
      updatedAt: entry.fechaActualizacion,
      source,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[${source}] Failed: ${message}`);
    return { source, error: message };
  }
}

/** Fetch the official BCV and paralelo USD rates with a single request */
export async function fetchDolares(): Promise<{
  oficial: Rate;
  paralelo: Rate;
}> {
  let data: DolarApiResponse[];
  try {
    data = await fetchWithTimeout(DOLARES_URL);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[dolarapi dolares] Failed: ${message}`);
    return {
      oficial: { source: "BCV", error: message },
      paralelo: { source: "Paralelo", error: message },
    };
  }
  return {
    oficial: readDolarEntry(data, "oficial", "BCV"),
    paralelo: readDolarEntry(data, "paralelo", "Paralelo"),
  };
}

/** Fetch the official BCV EUR rate */
export async function fetchBcvEur(): Promise<Rate> {
  try {
    const data = await fetchWithTimeout(EUROS_URL);
    const oficial = pickByFuente(data, "oficial");
    if (!oficial) throw new Error("No 'oficial' entry in euros response");
    return {
      price: readValidPrice(oficial.promedio),
      updatedAt: oficial.fechaActualizacion,
      source: "BCV",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[BCV EUR] Failed: ${message}`);
    return { source: "BCV", error: message };
  }
}
