import { CurrencyCode, formatMoney } from './money';
import type { Expense } from './types';

/** How an expense is divided between people. Amounts are in minor units. */
export type Split =
  | { kind: 'equal'; among: string[] }
  | { kind: 'shares'; shares: Record<string, number> }
  | { kind: 'exact'; amounts: Record<string, number> };

export type SplitKind = Split['kind'];

/**
 * Divides `total` in proportion to `weights` so that every part is whole and
 * the parts add up to exactly `total` (the largest remainder method). Leftover
 * units go to the largest fractional parts, ties to the earliest entry, so
 * the result never depends on anything but the input.
 *
 * Weights can be amounts of money themselves (an exact split converted from
 * another currency), and total × weight can then pass 2^53, where floating
 * point stops counting in ones. Those cases are done in BigInt.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  if (sum <= 0) throw new Error('allocate needs at least one positive weight');
  const exactInNumbers = Number.isSafeInteger(total * Math.max(...weights)) && Number.isSafeInteger(sum);
  const shares = exactInNumbers
    ? weights.map((weight) => ({ part: Math.floor((total * weight) / sum), remainder: (total * weight) % sum }))
    : weights.map((weight) => {
        const product = BigInt(total) * BigInt(weight);
        // Both fit in a number again: the part is at most the total, the remainder below the sum.
        return { part: Number(product / BigInt(sum)), remainder: Number(product % BigInt(sum)) };
      });
  const parts = shares.map(({ part }) => part);
  let leftover = total - parts.reduce((acc, part) => acc + part, 0);
  const order = shares.map(({ remainder }, index) => ({ index, remainder })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (leftover === 0) break;
    parts[index] += 1;
    leftover -= 1;
  }
  return parts;
}

/** Each person's share of an expense, in minor units. The shares always add up to `amount`. */
export function sharesOf(amount: number, split: Split): Record<string, number> {
  const result: Record<string, number> = {};
  if (split.kind === 'exact') {
    for (const [id, value] of Object.entries(split.amounts)) if (value > 0) result[id] = value;
    return result;
  }
  const entries =
    split.kind === 'equal'
      ? split.among.map((id) => [id, 1] as const)
      : Object.entries(split.shares).filter(([, weight]) => weight > 0);
  const parts = allocate(
    amount,
    entries.map(([, weight]) => weight)
  );
  entries.forEach(([id], index) => {
    if (parts[index] > 0) result[id] = parts[index];
  });
  return result;
}

/**
 * Each person's share of an expense in the group's currency, adding up to
 * exactly its amount. Paid in another currency, the split is worked out in
 * that currency first, then the converted total is divided in the same
 * proportions, so no penny is lost or made up in the conversion.
 */
export function expenseShares(expense: Pick<Expense, 'amount' | 'split' | 'original'>): Record<string, number> {
  if (!expense.original) return sharesOf(expense.amount, expense.split);
  const inOriginal = Object.entries(sharesOf(expense.original.amount, expense.split));
  if (inOriginal.length === 0 || expense.amount === 0) return {};
  const parts = allocate(
    expense.amount,
    inOriginal.map(([, share]) => share)
  );
  const result: Record<string, number> = {};
  inOriginal.forEach(([id], index) => {
    if (parts[index] > 0) result[id] = parts[index];
  });
  return result;
}

/** Who takes part in an expense. */
export function participantsOf(split: Split): string[] {
  if (split.kind === 'equal') return split.among;
  const values = split.kind === 'shares' ? split.shares : split.amounts;
  return Object.entries(values)
    .filter(([, value]) => value > 0)
    .map(([id]) => id);
}

/** A reason the split can't be saved, in words a person can act on, or null if it's fine. */
export function splitProblem(amount: number, split: Split, currency: CurrencyCode): string | null {
  if (!(amount > 0)) return 'Enter an amount above zero.';
  if (participantsOf(split).length === 0) return 'Choose at least one person to split with.';
  if (split.kind === 'shares') {
    const bad = Object.values(split.shares).some((weight) => !Number.isInteger(weight) || weight < 0);
    if (bad) return 'Shares must be whole numbers.';
  }
  if (split.kind === 'exact') {
    const total = Object.values(split.amounts).reduce((acc, value) => acc + value, 0);
    if (total < amount) return `${formatMoney(amount - total, currency)} still to assign.`;
    if (total > amount) return `${formatMoney(total - amount, currency)} over the total.`;
  }
  return null;
}
