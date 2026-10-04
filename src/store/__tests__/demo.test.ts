import { balancesOf, directDebts } from '@/lib/balances';
import { settle } from '@/lib/settle';
import { convert } from '@/lib/fx';
import { splitProblem } from '@/lib/split';

import { daysAgo } from '@/lib/dates';

import { demoGroups } from '../demo';

describe('demo groups', () => {
  const groups = demoGroups(new Date(2026, 9, 3));

  it('are all valid', () => {
    for (const group of groups) {
      for (const expense of group.expenses) {
        const paid = expense.original ?? { amount: expense.amount, currency: group.currency };
        expect(splitProblem(paid.amount, expense.split, paid.currency)).toBeNull();
      }
    }
  });

  it('pays for the JR Passes in pounds, converted exactly', () => {
    const passes = groups[0].expenses.find((expense) => expense.original);
    expect(passes?.original).toEqual({ amount: 131000, currency: 'GBP', rate: { base: 'GBP', value: '207.31' } });
    // £1,310.00 × 207.31 = ¥271,576.10.
    expect(passes?.amount).toBe(271576);
    expect(convert(131000, 'GBP', 'JPY', passes!.original!.rate)).toBe(passes?.amount);
  });

  it('keeps every version 1 expense, under the same id', () => {
    const before = demoGroups(new Date(2026, 9, 3), 1)[0].expenses.map((expense) => expense.id);
    expect(groups[0].expenses.map((expense) => expense.id)).toEqual([...before, 'japan_e10', 'japan_e11']);
  });

  it('itemises the okonomiyaki, adding up to the yen', () => {
    const okonomiyaki = groups[0].expenses.find((expense) => expense.split.kind === 'items');
    expect(okonomiyaki?.description).toBe('Okonomiyaki in Dotonbori');
    expect(okonomiyaki?.amount).toBe(9750);
  });

  it('show off the saving on the trip, and one group already settled', () => {
    const summary = groups.map((group) => {
      const balance = balancesOf(group.members.map((m) => m.id), group.expenses, group.payments);
      return { name: group.name, direct: directDebts(group.expenses, group.payments).length, settled: settle(balance).transfers.length, balance };
    });
    const [japan, , brighton] = summary;
    expect(japan.direct).toBe(10);
    expect(japan.settled).toBe(4);
    expect(brighton.settled).toBe(0);
  });

  it('dates expenses relative to today', () => {
    expect(daysAgo(1, new Date(2026, 9, 3))).toBe('2026-10-02');
    expect(daysAgo(3, new Date(2026, 0, 2))).toBe('2025-12-30');
  });
});
