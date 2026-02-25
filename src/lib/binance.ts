import type { Rate, BinanceP2PResponse } from './types';

const BINANCE_P2P_URL =
  'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

async function fetchP2PAds(
  tradeType: 'BUY' | 'SELL',
  signal: AbortSignal
): Promise<number[]> {
  const response = await fetch(BINANCE_P2P_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fiat: 'VES',
      page: 1,
      rows: 10,
      tradeType,
      asset: 'USDT',
      payTypes: [],
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Binance P2P API returned ${response.status} for ${tradeType}`);
  }

  const data: BinanceP2PResponse = await response.json();

  if (!data.data || data.data.length === 0) {
    throw new Error(`No P2P ${tradeType} ads returned`);
  }

  return data.data.map((ad) => parseFloat(ad.adv.price));
}

export async function fetchBinanceP2PRate(): Promise<Rate> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // Fetch BUY and SELL ads in parallel
    const [buyPrices, sellPrices] = await Promise.all([
      fetchP2PAds('BUY', controller.signal),
      fetchP2PAds('SELL', controller.signal),
    ]);
    clearTimeout(timeout);

    // Best price to sell USDT = highest BUY ad price
    const bestBuy = Math.max(...buyPrices);
    // Best price to buy USDT = lowest SELL ad price
    const bestSell = Math.min(...sellPrices);

    // Mid-market rate: average of the two best prices
    const midPrice = (bestBuy + bestSell) / 2;

    return {
      price: midPrice,
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
