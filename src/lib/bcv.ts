// ---------------------------------------------------------------------------
// BCV (Banco Central de Venezuela) – Dólar y Euro oficial
// Source: ve.dolarapi.com (wrapper around BCV data)
//
// Endpoints used:
//   - https://ve.dolarapi.com/v1/dolares  → [{ fuente: "oficial", promedio, ... }]
//   - https://ve.dolarapi.com/v1/euros    → [{ fuente: "oficial", promedio, ... }]
//
// TODO: Consider adding retry logic (see main branch bcv.ts for reference)
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
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function pickByFuente(
  data: DolarApiResponse[],
  fuente: string,
): DolarApiResponse | undefined {
  return data.find((d) => d.fuente === fuente);
}

/** Fetch the official BCV USD rate */
export async function fetchBcvUsd(): Promise<Rate> {
  return fetchDolarByFuente("oficial", "BCV");
}

/** Fetch the paralelo USD rate */
export async function fetchParaleloUsd(): Promise<Rate> {
  return fetchDolarByFuente("paralelo", "Paralelo");
}

async function fetchDolarByFuente(
  fuente: "oficial" | "paralelo",
  source: string,
): Promise<Rate> {
  try {
    const data = await fetchWithTimeout(DOLARES_URL);
    const result = pickByFuente(data, fuente);
    if (!result) throw new Error(`No '${fuente}' entry in dolares response`);
    return {
      price: result.promedio,
      updatedAt: result.fechaActualizacion,
      source,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[${source}] Failed: ${message}`);
    return { source, error: message };
  }
}

/** Fetch the official BCV EUR rate */
export async function fetchBcvEur(): Promise<Rate> {
  try {
    const data = await fetchWithTimeout(EUROS_URL);
    const oficial = pickByFuente(data, "oficial");
    if (!oficial) throw new Error("No 'oficial' entry in euros response");
    return {
      price: oficial.promedio,
      updatedAt: oficial.fechaActualizacion,
      source: "BCV",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[BCV EUR] Failed: ${message}`);
    return { source: "BCV", error: message };
  }
}
