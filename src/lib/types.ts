import type { CategoryId } from './categories';
import type { Rate } from './fx';
import type { CurrencyCode } from './money';
import type { PayMethod } from './pay';
import type { Split } from './split';

export type Member = {
  id: string;
  name: string;
  /** Index into the avatar palette. */
  tone: number;
  /**
   * They've left the group: kept for the expenses and payments they're part
   * of, and still in the balances, but no longer offered for new expenses.
   */
  left?: boolean;
  /** How they get paid, in the order they'd like: shown to whoever owes them. */
  pay?: PayMethod[];
};

/** What was actually paid, when it wasn't in the group's currency. */
export type Original = {
  /** Minor units of `currency`. */
  amount: number;
  currency: CurrencyCode;
  /** The rate it was converted at, fixed when the expense was saved. */
  rate: Rate;
};

export type Expense = {
  id: string;
  description: string;
  /** Minor units, in the group's currency: what the balances add up. */
  amount: number;
  /**
   * Set when it was paid in another currency. The split is then over the
   * original amount, and `amount` is that converted at the rate.
   */
  original?: Original;
  paidBy: string;
  split: Split;
  category: CategoryId;
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  note?: string;
  createdAt: number;
  updatedAt?: number;
};

/** Money handed over to settle up: `from` pays `to`. */
export type Payment = {
  id: string;
  from: string;
  to: string;
  amount: number;
  date: string;
  note?: string;
  createdAt: number;
};

export type Group = {
  id: string;
  name: string;
  currency: CurrencyCode;
  members: Member[];
  /** The member who is the person using the app. */
  me: string;
  expenses: Expense[];
  payments: Payment[];
  createdAt: number;
  updatedAt?: number;
  /**
   * What shared copies of the group know each other by: given to a group the
   * first time it's shared, and carried by every copy made from a link. (Ids
   * alone won't do: every visitor's demo trip has the same one.)
   */
  origin?: string;
};
