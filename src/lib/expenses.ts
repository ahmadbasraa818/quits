import type { CurrencyCode } from './money';
import { participantsOf } from './split';
import type { Expense, Group, Member } from './types';

/** Who an expense can involve: everyone who hasn't left, and anyone already on it. */
export function peopleFor(group: Group, expense: Expense | undefined): Member[] {
  const involved = new Set(expense ? [expense.paidBy, ...participantsOf(expense.split)] : []);
  return group.members.filter((member) => !member.left || involved.has(member.id));
}

/**
 * The currency a new expense starts in: whichever most of the group's last
 * five expenses were paid in, so a pound group on a trip to Japan offers yen
 * once yen is what people are spending. Ties go to the group's currency.
 */
export function likelyCurrency(group: Group): CurrencyCode {
  const recent = [...group.expenses].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const counts = new Map<CurrencyCode, number>([[group.currency, 0]]);
  for (const expense of recent) {
    const code = expense.original?.currency ?? group.currency;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let best = group.currency;
  for (const [code, count] of counts) if (count > (counts.get(best) ?? 0)) best = code;
  return best;
}
