import { CurrencyCode, formatMoney } from './money';

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
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  if (sum <= 0) throw new Error('allocate needs at least one positive weight');
  const parts = weights.map((weight) => Math.floor((total * weight) / sum));
  let leftover = total - parts.reduce((acc, part) => acc + part, 0);
  const order = weights
    .map((weight, index) => ({ index, remainder: (total * weight) % sum }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
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
