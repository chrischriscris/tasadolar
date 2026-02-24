import type { Rate, DolarApiResponse } from './types';

const BCV_URLS = [
  'https://ve.dolarapi.com/v1/dolares/oficial',
  'https://ve.dolarapi.com/v1/dolares',
];

async function tryFetch(url: string, timeoutMs: number): Promise<DolarApiResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // The /v1/dolares endpoint returns an array; pick the "oficial" entry
    if (Array.isArray(data)) {
      const oficial = data.find((d: DolarApiResponse) => d.fuente === 'oficial');
      if (!oficial) throw new Error('No oficial entry in array response');
      return oficial;
    }

    return data as DolarApiResponse;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export async function fetchBcvRate(): Promise<Rate> {
  for (const url of BCV_URLS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await tryFetch(url, 8000);
        return {
          price: data.promedio,
          updatedAt: data.fechaActualizacion,
          source: 'BCV',
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        console.warn(`[BCV] ${url} attempt ${attempt + 1} failed: ${msg}`);
      }
    }
  }

  console.error('[BCV] All fetch attempts exhausted');
  return {
    source: 'BCV',
    error: 'All fetch attempts failed',
  };
}
