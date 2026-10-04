import type { Transfer } from './balances';

/** Groups up to this many unsettled people are settled exactly; larger ones greedily. */
export const EXACT_LIMIT = 16;

export type Settlement = {
  transfers: Transfer[];
  method: 'exact' | 'greedy';
  /**
   * The groups of people whose balances cancel out among themselves, each
   * settling in one payment fewer than its size. Greedy settling doesn't
   * look for them, so it reports everyone as one.
   */
  circles: string[][];
};

type Entry = { id: string; amount: number };

/**
 * The payments that bring every balance to zero, as few as possible.
 *
 * Finding the fewest payments is NP-hard in general. It comes down to this:
 * if the people who are owed or owe can be split into k groups whose balances
 * each add up to zero, they can settle in n - k payments, and no fewer. A
 * dynamic program over subsets finds the largest k in O(2^n * n) steps, which
 * is instant for groups of up to 16 unsettled people. Beyond that, a greedy
 * match of the largest debtor with the largest creditor takes at most n - 1.
 */
export function settle(balance: Record<string, number>): Settlement {
  const entries = Object.entries(balance)
    .filter(([, amount]) => amount !== 0)
    .map(([id, amount]) => ({ id, amount }));
  if (entries.length <= EXACT_LIMIT) {
    const circles = zeroSumCircles(entries);
    return { transfers: circles.flatMap((circle) => greedySettle(circle)), method: 'exact', circles: circles.map((circle) => circle.map((entry) => entry.id)) };
  }
  return { transfers: greedySettle(entries), method: 'greedy', circles: entries.length > 0 ? [entries.map((entry) => entry.id)] : [] };
}

/** Matches the largest debtor with the largest creditor until everyone is square. */
export function greedySettle(entries: Entry[]): Transfer[] {
  const debtors = entries.filter((e) => e.amount < 0).map((e) => ({ ...e, amount: -e.amount }));
  const creditors = entries.filter((e) => e.amount > 0).map((e) => ({ ...e }));
  const transfers: Transfer[] = [];
  const largest = (list: Entry[]) => list.reduce((best, e) => (e.amount > best.amount ? e : best), list[0]);
  while (debtors.some((e) => e.amount > 0) && creditors.some((e) => e.amount > 0)) {
    const debtor = largest(debtors.filter((e) => e.amount > 0));
    const creditor = largest(creditors.filter((e) => e.amount > 0));
    const amount = Math.min(debtor.amount, creditor.amount);
    transfers.push({ from: debtor.id, to: creditor.id, amount });
    debtor.amount -= amount;
    creditor.amount -= amount;
  }
  return transfers;
}

/** The provably fewest payments, by splitting people into as many zero-sum groups as possible. */
export function exactSettle(entries: Entry[]): Transfer[] {
  return zeroSumCircles(entries).flatMap((circle) => greedySettle(circle));
}

/** The most groups whose balances each add up to zero that the people can be split into. */
export function zeroSumCircles(entries: Entry[]): Entry[][] {
  const n = entries.length;
  if (n === 0) return [];
  const full = (1 << n) - 1;
  const sum = new Float64Array(1 << n);
  const groups = new Int8Array(1 << n);
  for (let mask = 1; mask <= full; mask += 1) {
    const low = mask & -mask;
    const bit = 31 - Math.clz32(low);
    sum[mask] = sum[mask ^ low] + entries[bit].amount;
    // The most zero-sum groups among people taken in some order, ending with this set.
    let best = 0;
    for (let rest = mask; rest; rest &= rest - 1) {
      const i = 31 - Math.clz32(rest & -rest);
      const without = groups[mask ^ (1 << i)];
      if (without > best) best = without;
    }
    groups[mask] = best + (sum[mask] === 0 ? 1 : 0);
  }

  // Walk back from everyone, peeling people off without losing a group, to recover an order
  // in which the running total returns to zero exactly at the end of each group.
  const order: number[] = [];
  for (let mask = full; mask; ) {
    const gained = sum[mask] === 0 ? 1 : 0;
    let next = -1;
    for (let rest = mask; rest; rest &= rest - 1) {
      const i = 31 - Math.clz32(rest & -rest);
      if (groups[mask ^ (1 << i)] + gained === groups[mask]) {
        next = i;
        break;
      }
    }
    order.push(next);
    mask ^= 1 << next;
  }
  order.reverse();

  const circles: Entry[][] = [];
  let circle: Entry[] = [];
  let running = 0;
  for (const index of order) {
    circle.push(entries[index]);
    running += entries[index].amount;
    if (running === 0) {
      circles.push(circle);
      circle = [];
    }
  }
  return circles;
}
