import type { CategoryId } from './categories';
import type { CurrencyCode } from './money';
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
};

export type Expense = {
  id: string;
  description: string;
  /** Minor units. */
  amount: number;
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
};
