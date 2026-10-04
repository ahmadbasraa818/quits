import * as fc from 'fast-check';

import { convert, parseRateValue, Rate } from '../fx';
import { allocate } from '../split';
import type { Expense, Payment } from '../types';

/** A random group in pounds: 2 to 9 people, up to 15 expenses split every which way, some paid in other currencies, and a few payments. */
export const groupArbitrary = fc.integer({ min: 2, max: 9 }).chain((size) => {
  const ids = Array.from({ length: size }, (_, i) => `m${i}`);
  // Sometimes paid in another currency, at a random rate, in a group that keeps pounds.
  const foreign = fc.option(
    fc.record({
      currency: fc.constantFrom('USD', 'EUR', 'JPY', 'KRW' as const),
      // From 1 to 200, read either way round: rates are kept the way round that reads above one, and
      // converted amounts then stay within what the app holds, as the form makes sure.
      value: fc.integer({ min: 1000, max: 200_000 }).map((n) => parseRateValue(String(n / 1000))!),
      base: fc.boolean(),
    }),
    { nil: undefined }
  );
  const expense = fc
    .record({
      paid: fc.integer({ min: 1, max: 500_000 }),
      paidBy: fc.constantFrom(...ids),
      kind: fc.constantFrom('equal', 'shares', 'exact', 'items'),
      weights: fc.array(fc.integer({ min: 0, max: 4 }), { minLength: size, maxLength: size }).filter((w) => w.some((x) => x > 0)),
      foreign,
    })
    .map(({ paid, paidBy, kind, weights, foreign: other }): Expense => {
      const rate: Rate | undefined = other && { base: other.base ? other.currency : 'GBP', value: other.value };
      const original = other && rate ? { amount: paid, currency: other.currency, rate } : undefined;
      const amount = original ? convert(paid, original.currency, 'GBP', original.rate) : paid;
      const base = { id: 'e', description: 'x', amount, original, paidBy, category: 'other' as const, date: '2026-11-21', createdAt: 0 };
      if (kind === 'equal') return { ...base, split: { kind, among: ids.filter((_, i) => weights[i] > 0) } };
      if (kind === 'shares') return { ...base, split: { kind, shares: Object.fromEntries(ids.map((id, i) => [id, weights[i]])) } };
      if (kind === 'items') {
        // One item per person with a weight, shared by them and the next person along.
        const priced = ids.map((id, i) => ({ id, i })).filter(({ i }) => weights[i] > 0);
        const prices = allocate(paid, priced.map(({ i }) => weights[i]));
        const items = priced.map(({ id, i }, n) => ({ id: `i${n}`, label: 'x', amount: prices[n], among: [...new Set([id, ids[(i + 1) % ids.length]])] }));
        return { ...base, split: { kind, items, extras: 0 } };
      }
      const parts = allocate(paid, weights);
      return { ...base, split: { kind, amounts: Object.fromEntries(ids.map((id, i) => [id, parts[i]])) } };
    });
  const payment = fc
    .record({ from: fc.constantFrom(...ids), to: fc.constantFrom(...ids), amount: fc.integer({ min: 1, max: 50_000 }) })
    .filter(({ from, to }) => from !== to)
    .map((p): Payment => ({ id: 'p', date: '2026-11-22', createdAt: 0, ...p }));
  return fc.record({
    ids: fc.constant(ids),
    expenses: fc.array(expense, { maxLength: 15 }),
    payments: fc.array(payment, { maxLength: 3 }),
  });
});
