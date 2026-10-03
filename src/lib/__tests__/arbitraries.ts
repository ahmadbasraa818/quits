import * as fc from 'fast-check';

import { allocate } from '../split';
import type { Expense, Payment } from '../types';

/** A random group: 2 to 9 people, up to 15 expenses split every which way, and a few payments. */
export const groupArbitrary = fc.integer({ min: 2, max: 9 }).chain((size) => {
  const ids = Array.from({ length: size }, (_, i) => `m${i}`);
  const expense = fc
    .record({
      amount: fc.integer({ min: 1, max: 500_000 }),
      paidBy: fc.constantFrom(...ids),
      kind: fc.constantFrom('equal', 'shares', 'exact'),
      weights: fc.array(fc.integer({ min: 0, max: 4 }), { minLength: size, maxLength: size }).filter((w) => w.some((x) => x > 0)),
    })
    .map(({ amount, paidBy, kind, weights }, ): Expense => {
      const base = { id: 'e', description: 'x', amount, paidBy, category: 'other' as const, date: '2026-11-21', createdAt: 0 };
      if (kind === 'equal') return { ...base, split: { kind, among: ids.filter((_, i) => weights[i] > 0) } };
      if (kind === 'shares') return { ...base, split: { kind, shares: Object.fromEntries(ids.map((id, i) => [id, weights[i]])) } };
      const parts = allocate(amount, weights);
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
