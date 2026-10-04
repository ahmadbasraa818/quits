import * as fc from 'fast-check';

import { balancesOf, Transfer } from '../balances';
import { EXACT_LIMIT, exactSettle, greedySettle, settle } from '../settle';
import { groupArbitrary } from './arbitraries';

function apply(balance: Record<string, number>, transfers: Transfer[]) {
  const after = { ...balance };
  for (const { from, to, amount } of transfers) {
    after[from] += amount;
    after[to] -= amount;
  }
  return after;
}

/** An independent check: the classic backtracking search for the fewest payments. */
function fewestByBacktracking(amounts: number[]): number {
  const debts = amounts.filter((value) => value !== 0);
  const search = (start: number): number => {
    while (start < debts.length && debts[start] === 0) start += 1;
    if (start === debts.length) return 0;
    let best = Infinity;
    for (let i = start + 1; i < debts.length; i += 1) {
      if (debts[i] * debts[start] < 0) {
        debts[i] += debts[start];
        best = Math.min(best, 1 + search(start + 1));
        debts[i] -= debts[start];
      }
    }
    return best;
  };
  return search(0);
}

const entries = (balance: Record<string, number>) =>
  Object.entries(balance)
    .filter(([, amount]) => amount !== 0)
    .map(([id, amount]) => ({ id, amount }));

describe('settle', () => {
  it('turns a chain of debts into one payment', () => {
    expect(settle({ a: -1000, b: 0, c: 1000 }).transfers).toEqual([{ from: 'a', to: 'c', amount: 1000 }]);
  });

  it('has nothing to do when everyone is square', () => {
    expect(settle({ a: 0, b: 0 })).toEqual({ transfers: [], method: 'exact', circles: [] });
  });

  it('names the circles that cancel out', () => {
    const { circles, transfers } = settle({ a: 10, b: -10, c: 5, d: 2, e: -7, f: 0 });
    expect(circles.map((circle) => [...circle].sort())).toEqual(expect.arrayContaining([['a', 'b'], ['c', 'd', 'e']]));
    expect(circles).toHaveLength(2);
    expect(transfers).toHaveLength(3);
  });

  it('settles each circle in one payment fewer than its size', () => {
    fc.assert(
      fc.property(groupArbitrary, ({ ids, expenses, payments }) => {
        const balance = balancesOf(ids, expenses, payments);
        const { circles, transfers } = settle(balance);
        const owing = ids.filter((id) => balance[id] !== 0).sort();
        expect(circles.flat().sort()).toEqual(owing);
        for (const circle of circles) expect(circle.reduce((sum, id) => sum + balance[id], 0)).toBe(0);
        expect(transfers).toHaveLength(owing.length - circles.length);
      })
    );
  });

  it('beats the greedy match when people fall into separate circles', () => {
    // b and c settle between themselves; a, d and e make another circle.
    const balance = { a: 800, b: 500, c: -500, d: -400, e: -400 };
    expect(greedySettle(entries(balance))).toHaveLength(4);
    const { transfers } = settle(balance);
    expect(transfers).toHaveLength(3);
    expect(apply(balance, transfers)).toEqual({ a: 0, b: 0, c: 0, d: 0, e: 0 });
  });

  it('settles every group completely, in the fewest payments there are', () => {
    fc.assert(
      fc.property(groupArbitrary, ({ ids, expenses, payments }) => {
        const balance = balancesOf(ids, expenses, payments);
        const { transfers } = settle(balance);
        expect(Object.values(apply(balance, transfers)).every((value) => value === 0)).toBe(true);
        transfers.forEach(({ from, to, amount }) => {
          expect(from).not.toBe(to);
          expect(Number.isInteger(amount) && amount > 0).toBe(true);
          expect(balance[from]).toBeLessThan(0);
          expect(balance[to]).toBeGreaterThan(0);
        });
        const unsettled = entries(balance).length;
        expect(transfers.length).toBeLessThanOrEqual(Math.max(0, unsettled - 1));
        expect(transfers.length).toBeLessThanOrEqual(greedySettle(entries(balance)).length);
        expect(transfers.length).toBe(fewestByBacktracking(Object.values(balance)));
      }),
      { numRuns: 400 }
    );
  });

  it('falls back to the greedy match for very large groups, still settling everyone', () => {
    const size = EXACT_LIMIT + 4;
    const balance: Record<string, number> = {};
    for (let i = 0; i < size; i += 1) balance[`m${i}`] = i % 2 === 0 ? 1000 + i : -(1000 + i - 1);
    balance.m0 -= Object.values(balance).reduce((a, b) => a + b, 0);
    const { transfers, method } = settle(balance);
    expect(method).toBe('greedy');
    expect(Object.values(apply(balance, transfers)).every((value) => value === 0)).toBe(true);
  });

  it('settles 16 people exactly in a blink', () => {
    const balance: Record<string, number> = {};
    for (let i = 0; i < EXACT_LIMIT; i += 1) balance[`m${i}`] = (i % 2 === 0 ? 1 : -1) * (100 + 7 * i);
    balance.m0 -= Object.values(balance).reduce((a, b) => a + b, 0);
    const started = Date.now();
    const transfers = exactSettle(entries(balance));
    expect(Date.now() - started).toBeLessThan(2000);
    expect(Object.values(apply(balance, transfers)).every((value) => value === 0)).toBe(true);
  });
});
