import { expenseShares } from './split';
import type { Expense, Payment } from './types';

export type Transfer = { from: string; to: string; amount: number };

/**
 * Each member's balance in minor units: positive if the group owes them,
 * negative if they owe the group. Balances always add up to zero.
 */
export function balancesOf(memberIds: string[], expenses: Expense[], payments: Payment[]): Record<string, number> {
  const balance: Record<string, number> = {};
  for (const id of memberIds) balance[id] = 0;
  const add = (id: string, value: number) => {
    balance[id] = (balance[id] ?? 0) + value;
  };
  for (const expense of expenses) {
    add(expense.paidBy, expense.amount);
    for (const [id, share] of Object.entries(expenseShares(expense))) add(id, -share);
  }
  for (const payment of payments) {
    add(payment.from, payment.amount);
    add(payment.to, -payment.amount);
  }
  return balance;
}

/**
 * The debts as they stand without any simplifying: everyone owes each person
 * who paid for them, netted pair by pair. Settling a group this way takes one
 * payment per pair, which is what Quits saves people from.
 */
export function directDebts(expenses: Expense[], payments: Payment[]): Transfer[] {
  const owed = new Map<string, number>();
  const key = (from: string, to: string) => `${from}\u0000${to}`;
  const add = (from: string, to: string, amount: number) => {
    if (from === to || amount === 0) return;
    owed.set(key(from, to), (owed.get(key(from, to)) ?? 0) + amount);
    owed.set(key(to, from), (owed.get(key(to, from)) ?? 0) - amount);
  };
  for (const expense of expenses) {
    for (const [id, share] of Object.entries(expenseShares(expense))) add(id, expense.paidBy, share);
  }
  for (const payment of payments) add(payment.from, payment.to, -payment.amount);
  const transfers: Transfer[] = [];
  for (const [pair, amount] of owed) {
    if (amount <= 0) continue;
    const [from, to] = pair.split('\u0000');
    transfers.push({ from, to, amount });
  }
  return transfers;
}

export function totalOf(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}
