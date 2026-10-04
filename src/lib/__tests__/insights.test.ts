import * as fc from 'fast-check';

import { demoGroups } from '@/store/demo';

import { balancesOf, totalOf } from '../balances';
import { addDays } from '../dates';
import { filterExpenses, spendingByCategory, spendingOverTime, statementFor, weekOf, whoPaidWhoUsed } from '../insights';
import type { Expense, Group } from '../types';
import { groupArbitrary } from './arbitraries';

const [japan, flat] = demoGroups(new Date(2026, 9, 4));
const asGroup = ({ ids, expenses, payments }: { ids: string[]; expenses: Expense[]; payments: Group['payments'] }): Group => ({
  id: 'g',
  name: 'G',
  currency: 'GBP',
  me: ids[0],
  members: ids.map((id, tone) => ({ id, name: id, tone })),
  expenses,
  payments,
  createdAt: 0,
});
const dated = (date: string, amount: number): Expense => ({ id: date, description: 'x', amount, paidBy: 'a', split: { kind: 'equal', among: ['a'] }, category: 'food', date, createdAt: 0 });

describe('spending by category', () => {
  it('puts the biggest first', () => {
    const categories = spendingByCategory(japan.expenses);
    expect(categories[0]).toEqual({ category: 'transport', amount: 69750 + 10000 + 271576, count: 3 });
    expect(categories[1]).toEqual({ category: 'stay', amount: 168000 + 126000, count: 2 });
  });

  it('accounts for every expense', () => {
    fc.assert(
      fc.property(groupArbitrary, ({ expenses }) => {
        const categories = spendingByCategory(expenses);
        expect(categories.reduce((sum, c) => sum + c.amount, 0)).toBe(totalOf(expenses));
        expect(categories.reduce((sum, c) => sum + c.count, 0)).toBe(expenses.length);
      })
    );
  });
});

describe('spending over time', () => {
  it('goes by day for a trip, keeping the quiet days', () => {
    const { unit, buckets } = spendingOverTime(japan.expenses);
    expect(unit).toBe('day');
    // From the JR Passes, 38 days back, to the last top-up, 27 days back.
    expect(buckets).toHaveLength(12);
    expect(buckets.filter((bucket) => bucket.count === 0).length).toBeGreaterThan(0);
  });

  it('goes by week, then by month, as the span grows', () => {
    expect(spendingOverTime([dated('2026-01-01', 1), dated('2026-03-01', 1)]).unit).toBe('week');
    const months = spendingOverTime([dated('2025-11-20', 5), dated('2026-10-03', 7)]);
    expect(months.unit).toBe('month');
    expect(months.buckets[0]).toEqual({ start: '2025-11-01', amount: 5, count: 1 });
    expect(months.buckets.map((bucket) => bucket.start)).toContain('2026-01-01');
    expect(months.buckets).toHaveLength(12);
  });

  it('starts weeks on a Monday', () => {
    expect(weekOf('2026-10-04')).toBe('2026-09-28');
    expect(weekOf('2026-09-28')).toBe('2026-09-28');
  });

  it('adds up to the total, in buckets that follow on from each other', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 900 }), fc.integer({ min: 1, max: 10_000 })), { minLength: 1, maxLength: 30 }), (entries) => {
        const expenses = entries.map(([offset, amount], i) => ({ ...dated(addDays('2024-01-01', offset), amount), id: `e${i}` }));
        const { buckets } = spendingOverTime(expenses);
        expect(buckets.reduce((sum, bucket) => sum + bucket.amount, 0)).toBe(totalOf(expenses));
        for (let i = 1; i < buckets.length; i += 1) expect(buckets[i].start > buckets[i - 1].start).toBe(true);
      })
    );
  });
});

describe('who paid, who used', () => {
  it('matches the balances exactly', () => {
    fc.assert(
      fc.property(groupArbitrary, (generated) => {
        const group = asGroup(generated);
        const balance = balancesOf(generated.ids, generated.expenses, generated.payments);
        for (const person of whoPaidWhoUsed(group)) expect(person.balance).toBe(balance[person.id] ?? 0);
        const people = whoPaidWhoUsed(group);
        expect(people.reduce((sum, p) => sum + p.paid, 0)).toBe(totalOf(generated.expenses));
        expect(people.reduce((sum, p) => sum + p.share, 0)).toBe(totalOf(generated.expenses));
      })
    );
  });
});

describe('a person’s statement', () => {
  it('adds up to their balance', () => {
    fc.assert(
      fc.property(groupArbitrary, (generated) => {
        const group = asGroup(generated);
        const balance = balancesOf(generated.ids, generated.expenses, generated.payments);
        for (const id of generated.ids) expect(statementFor(group, id).reduce((sum, line) => sum + line.effect, 0)).toBe(balance[id]);
      })
    );
  });

  it('shows what Aiko paid and used on the trip, oldest first', () => {
    const lines = statementFor(japan, 'aiko');
    expect(lines[0]).toMatchObject({ kind: 'expense', description: 'JR Passes, bought at home', paid: 0, share: 54315, effect: -54315 });
    expect(lines.find((line) => line.kind === 'expense' && line.description === 'teamLab Planets')).toMatchObject({ paid: 19200, share: 3840, effect: 15360 });
    expect(lines.some((line) => line.kind === 'expense' && line.description === 'Ichiran ramen')).toBe(false);
  });

  it('includes payments, each way', () => {
    const settled = demoGroups(new Date(2026, 9, 4))[2];
    expect(statementFor(settled, 'mia').filter((line) => line.kind === 'payment')).toEqual([
      expect.objectContaining({ direction: 'received', other: 'tom', amount: 2950, effect: -2950 }),
      expect.objectContaining({ direction: 'received', other: 'you', amount: 250, effect: -250 }),
    ]);
  });
});

describe('finding expenses', () => {
  it('matches the description or the note, ignoring case and accents', () => {
    expect(filterExpenses(japan.expenses, { query: 'RAMEN', category: null }).map((e) => e.description)).toEqual(['Ichiran ramen']);
    const withNote = [...flat.expenses, { ...flat.expenses[0], id: 'n', description: 'Coffee', note: 'Café au lait' }];
    expect(filterExpenses(withNote, { query: 'cafe', category: null }).map((e) => e.description)).toEqual(['Coffee']);
  });

  it('narrows to a category', () => {
    expect(filterExpenses(japan.expenses, { query: '', category: 'stay' }).map((e) => e.description)).toEqual(['Apartment in Shinjuku', 'Ryokan, two nights']);
    expect(filterExpenses(japan.expenses, { query: 'nara', category: 'stay' })).toEqual([]);
  });
});
