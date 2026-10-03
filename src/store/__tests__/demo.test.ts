import { balancesOf, directDebts } from '@/lib/balances';
import { settle } from '@/lib/settle';
import { splitProblem } from '@/lib/split';

import { daysAgo } from '@/lib/dates';

import { demoGroups } from '../demo';

describe('demo groups', () => {
  const groups = demoGroups(new Date(2026, 9, 3));

  it('are all valid', () => {
    for (const group of groups) {
      for (const expense of group.expenses) expect(splitProblem(expense.amount, expense.split, group.currency)).toBeNull();
    }
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
