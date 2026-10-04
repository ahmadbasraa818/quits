import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CurrencyCode } from '@/lib/money';
import { canLookUp, lookUpRate, RateLookup, RateQuote } from '@/lib/rates';

import { safeStorage } from './storage';

/** How many looked-up rates to keep. A past day's rate never changes, so they never go stale. */
const KEEP = 120;

type RatesState = {
  quotes: Record<string, RateQuote & { savedAt: number }>;
  remember: (key: string, quote: RateQuote) => void;
};

export const rateKey = (from: CurrencyCode, to: CurrencyCode, date: string) => `${from}>${to}@${date}`;

export const useRates = create<RatesState>()(
  persist(
    (set, get) => ({
      quotes: {},
      remember: (key, quote) => {
        const entries = Object.entries({ ...get().quotes, [key]: { ...quote, savedAt: Date.now() } });
        entries.sort(([, a], [, b]) => b.savedAt - a.savedAt);
        set({ quotes: Object.fromEntries(entries.slice(0, KEEP)) });
      },
    }),
    { name: 'quits-rates', version: 1, storage: createJSONStorage(() => safeStorage) }
  )
);

export type EcbRate =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; quote: RateQuote }
  | { status: 'unavailable'; reason: Exclude<RateLookup, { ok: true }>['reason']; retry: () => void };

/**
 * The ECB rate between two currencies for a date, looked up once and then
 * remembered. Does nothing while `enabled` is false.
 */
export function useEcbRate(from: CurrencyCode, to: CurrencyCode, date: string, enabled: boolean): EcbRate {
  const key = rateKey(from, to, date);
  const cached = useRates((state) => state.quotes[key]);
  const remember = useRates((state) => state.remember);
  const [failure, setFailure] = useState<{ key: string; reason: 'offline' | 'failed' } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const supported = canLookUp(from, to);

  useEffect(() => {
    if (!enabled || !supported || cached) return undefined;
    let current = true;
    lookUpRate(from, to, date).then((result) => {
      if (!current) return;
      if (result.ok) remember(key, result.quote);
      else if (result.reason !== 'unsupported') setFailure({ key, reason: result.reason });
    });
    return () => {
      current = false;
    };
  }, [enabled, supported, cached, from, to, date, key, remember, attempt]);

  if (!enabled) return { status: 'idle' };
  const retry = () => {
    setFailure(null);
    setAttempt((count) => count + 1);
  };
  if (!supported) return { status: 'unavailable', reason: 'unsupported', retry };
  if (cached) return { status: 'ready', quote: { rate: cached.rate, date: cached.date } };
  if (failure?.key === key) return { status: 'unavailable', reason: failure.reason, retry };
  return { status: 'loading' };
}
