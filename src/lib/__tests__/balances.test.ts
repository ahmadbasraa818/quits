import * as fc from 'fast-check';

import { balancesOf, directDebts, totalOf } from '../balances';
import type { Expense } from '../types';
import { groupArbitrary } from './arbitraries';

const expense = (amount: number, paidBy: string, among: string[]): Expense => ({
  id: `${paidBy}-${amount}`,
  description: 'Dinner',
  amount,
  paidBy,
  split: { kind: 'equal', among },
  category: 'food',
  date: '2026-11-21',
  createdAt: 0,
});

describe('balancesOf', () => {
  it('credits the payer and debits everyone who shared', () => {
    const balance = balancesOf(['a', 'b', 'c'], [expense(9000, 'a', ['a', 'b', 'c'])], []);
    expect(balance).toEqual({ a: 6000, b: -3000, c: -3000 });
  });

  it('counts payments made to settle up', () => {
    const balance = balancesOf(['a', 'b'], [expense(2000, 'a', ['a', 'b'])], [{ id: 'p', from: 'b', to: 'a', amount: 1000, date: '2026-11-22', createdAt: 0 }]);
    expect(balance).toEqual({ a: 0, b: 0 });
  });

  it('always adds up to zero', () => {
    fc.assert(
      fc.property(groupArbitrary, ({ ids, expenses, payments }) => {
        const total = Object.values(balancesOf(ids, expenses, payments)).reduce((a, b) => a + b, 0);
        expect(total).toBe(0);
      })
    );
  });
});

describe('directDebts', () => {
  it('nets what two people owe each other', () => {
    const debts = directDebts([expense(1000, 'a', ['a', 'b']), expense(400, 'b', ['a', 'b'])], []);
    expect(debts).toEqual([{ from: 'b', to: 'a', amount: 300 }]);
  });

  it('keeps a chain of debts as separate payments', () => {
    const debts = directDebts([expense(1000, 'b', ['a']), expense(1000, 'c', ['b'])], []);
    expect(debts).toHaveLength(2);
  });

  it('describes the same balances as balancesOf', () => {
    fc.assert(
      fc.property(groupArbitrary, ({ ids, expenses, payments }) => {
        const fromDebts: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
        for (const { from, to, amount } of directDebts(expenses, payments)) {
          fromDebts[from] -= amount;
          fromDebts[to] += amount;
        }
        expect(fromDebts).toEqual(balancesOf(ids, expenses, payments));
      })
    );
  });
});

describe('totalOf', () => {
  it('adds up what was spent', () => {
    expect(totalOf([expense(1000, 'a', ['a']), expense(250, 'b', ['a'])])).toBe(1250);
  });
});
