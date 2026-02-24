import type { Rate, DolarApiResponse } from './types';

const BCV_API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';

export async function fetchBcvRate(): Promise<Rate> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(BCV_API_URL, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`BCV API returned ${response.status}`);
    }

    const data: DolarApiResponse = await response.json();

    return {
      price: data.promedio,
      updatedAt: data.fechaActualizacion,
      source: 'BCV',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[BCV] Failed to fetch rate: ${message}`);
    return {
      source: 'BCV',
      error: message,
    };
  }
}
