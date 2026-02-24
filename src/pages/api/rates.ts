import type { APIRoute } from 'astro';
import type { Rate } from '../../lib/types';
import { fetchBcvRate } from '../../lib/bcv';
import { fetchBinanceP2PRate } from '../../lib/binance';

export const GET: APIRoute = async ({ url }) => {
  const only = url.searchParams.get('only'); // "bcv", "bin", or null (both)

  const result: { bcv?: Rate; binance?: Rate } = {};

  const tasks: Promise<void>[] = [];

  if (!only || only === 'bcv') {
    tasks.push(fetchBcvRate().then((r) => { result.bcv = r; }));
  }
  if (!only || only === 'bin') {
    tasks.push(fetchBinanceP2PRate().then((r) => { result.binance = r; }));
  }

  await Promise.all(tasks);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
    },
  });
};
