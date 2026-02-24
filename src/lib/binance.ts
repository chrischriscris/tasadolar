import type { Rate, BinanceP2PResponse } from './types';

const BINANCE_P2P_URL =
  'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export async function fetchBinanceP2PRate(): Promise<Rate> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(BINANCE_P2P_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fiat: 'VES',
        page: 1,
        rows: 10,
        tradeType: 'SELL',
        asset: 'USDT',
        payTypes: [],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Binance P2P API returned ${response.status}`);
    }

    const data: BinanceP2PResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new Error('No P2P ads returned');
    }

    const prices = data.data.map((ad) => parseFloat(ad.adv.price));
    const medianPrice = median(prices);

    return {
      price: medianPrice,
      updatedAt: new Date().toISOString(),
      source: 'Binance P2P',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Binance P2P] Failed to fetch rate: ${message}`);
    return {
      source: 'Binance P2P',
      error: message,
    };
  }
}
