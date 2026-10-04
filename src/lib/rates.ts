import { parseRateValue, Rate } from './fx';
import { CURRENCIES, CurrencyCode } from './money';

/** A rate the European Central Bank published, and the day it applies to. */
export type RateQuote = { rate: Rate; date: string };

export type RateLookup = { ok: true; quote: RateQuote } | { ok: false; reason: 'unsupported' | 'offline' | 'failed' };

/** The ECB's daily reference rates, served by Frankfurter: free, keyless and open to any website. */
export const RATES_API = 'https://api.frankfurter.dev/v1';

const TIMEOUT = 8000;

/** Whether the ECB publishes rates for both currencies, so Quits can look the rate up. */
export function canLookUp(a: CurrencyCode, b: CurrencyCode): boolean {
  return a !== b && CURRENCIES[a].liveRate && CURRENCIES[b].liveRate;
}

type Fetcher = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

async function fetchRate(fetcher: Fetcher, date: string, base: CurrencyCode, quote: CurrencyCode): Promise<{ value: number; date: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetcher(`${RATES_API}/${date}?base=${base}&symbols=${quote}`, { signal: controller.signal });
    if (!response.ok) throw new Error('The rates service said no');
    const body = (await response.json()) as { date?: unknown; rates?: Record<string, unknown> };
    const value = body.rates?.[quote];
    if (typeof value !== 'number' || !(value > 0) || typeof body.date !== 'string') throw new Error('Unexpected rates reply');
    return { value, date: body.date };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The ECB reference rate between two currencies on a date, the way round
 * that reads above one. On a weekend or holiday the ECB publishes nothing,
 * and the reply carries the last working day's rate and its date instead.
 */
export async function lookUpRate(from: CurrencyCode, to: CurrencyCode, date: string, fetcher: Fetcher = fetch as unknown as Fetcher): Promise<RateLookup> {
  if (!canLookUp(from, to)) return { ok: false, reason: 'unsupported' };
  try {
    let base = from;
    let found = await fetchRate(fetcher, date, from, to);
    if (found.value < 1) {
      base = to;
      found = await fetchRate(fetcher, date, to, from);
    }
    const value = parseRateValue(String(found.value));
    if (!value) return { ok: false, reason: 'failed' };
    return { ok: true, quote: { rate: { base, value }, date: found.date } };
  } catch (error) {
    // fetch rejects with a TypeError when there's no connection, and aborts when it's too slow.
    const offline = error instanceof TypeError || (error instanceof Error && error.name === 'AbortError');
    return { ok: false, reason: offline ? 'offline' : 'failed' };
  }
}
