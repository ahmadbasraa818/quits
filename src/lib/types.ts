import type { CategoryId } from './categories';
import type { CurrencyCode } from './money';
import type { Split } from './split';

export type Member = {
  id: string;
  name: string;
  /** Index into the avatar palette. */
  tone: number;
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
  createdAt: number;
};

/** Money handed over to settle up: `from` pays `to`. */
export type Payment = {
  id: string;
  from: string;
  to: string;
  amount: number;
  date: string;
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
};
