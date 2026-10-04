import { CATEGORIES, CategoryId } from './categories';
import { addDays, parseLocalDate } from './dates';
import { expenseShares } from './split';
import { fold } from './text';
import type { Expense, Group } from './types';

export type CategorySpend = { category: CategoryId; amount: number; count: number };

/** What was spent in each category, largest first; ties keep the categories' own order. */
export function spendingByCategory(expenses: Expense[]): CategorySpend[] {
  const totals = new Map<CategoryId, CategorySpend>();
  for (const expense of expenses) {
    const total = totals.get(expense.category) ?? { category: expense.category, amount: 0, count: 0 };
    total.amount += expense.amount;
    total.count += 1;
    totals.set(expense.category, total);
  }
  const order: CategoryId[] = CATEGORIES.map((category) => category.id);
  return [...totals.values()].sort((a, b) => b.amount - a.amount || order.indexOf(a.category) - order.indexOf(b.category));
}

export type TimeUnit = 'day' | 'week' | 'month';
export type Bucket = { start: string; amount: number; count: number };

const daysBetween = (from: string, to: string) => Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000);

/** The Monday of the week a date falls in. */
export function weekOf(date: string): string {
  return addDays(date, -((parseLocalDate(date).getDay() + 6) % 7));
}

function nextMonth(start: string): string {
  const [year, month] = start.split('-').map(Number);
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

/**
 * Spending over time: by day for anything up to a month, like a trip; by
 * week up to half a year; by month beyond, like a flat. Quiet stretches stay
 * in as empty buckets, so the gaps show.
 */
export function spendingOverTime(expenses: Expense[]): { unit: TimeUnit; buckets: Bucket[] } {
  if (expenses.length === 0) return { unit: 'day', buckets: [] };
  const dates = expenses.map((expense) => expense.date).sort();
  const [first, last] = [dates[0], dates[dates.length - 1]];
  const span = daysBetween(first, last) + 1;
  const unit: TimeUnit = span <= 31 ? 'day' : span <= 26 * 7 ? 'week' : 'month';
  const startOf = (date: string) => (unit === 'day' ? date : unit === 'week' ? weekOf(date) : `${date.slice(0, 7)}-01`);
  const after = (start: string) => (unit === 'day' ? addDays(start, 1) : unit === 'week' ? addDays(start, 7) : nextMonth(start));
  const buckets: Bucket[] = [];
  for (let start = startOf(first); start <= last; start = after(start)) buckets.push({ start, amount: 0, count: 0 });
  const index = new Map(buckets.map((bucket, i) => [bucket.start, i]));
  for (const expense of expenses) {
    const bucket = buckets[index.get(startOf(expense.date)) ?? -1];
    if (!bucket) continue;
    bucket.amount += expense.amount;
    bucket.count += 1;
  }
  return { unit, buckets };
}

export type PersonSpend = {
  id: string;
  /** What they paid for. */
  paid: number;
  /** Their part of everything, whoever paid. */
  share: number;
  /** Payments they made to settle up, and had. */
  sent: number;
  received: number;
  /** paid − share + sent − received: what the group owes them. */
  balance: number;
};

/** For each person: what they paid for, their share of it all, and the payments that moved between them. */
export function whoPaidWhoUsed(group: Group): PersonSpend[] {
  const people = new Map(group.members.map((member) => [member.id, { id: member.id, paid: 0, share: 0, sent: 0, received: 0, balance: 0 }]));
  const person = (id: string) => {
    if (!people.has(id)) people.set(id, { id, paid: 0, share: 0, sent: 0, received: 0, balance: 0 });
    return people.get(id)!;
  };
  for (const expense of group.expenses) {
    person(expense.paidBy).paid += expense.amount;
    for (const [id, share] of Object.entries(expenseShares(expense))) person(id).share += share;
  }
  for (const payment of group.payments) {
    person(payment.from).sent += payment.amount;
    person(payment.to).received += payment.amount;
  }
  for (const entry of people.values()) entry.balance = entry.paid - entry.share + entry.sent - entry.received;
  return [...people.values()];
}

export type StatementLine =
  | { kind: 'expense'; id: string; date: string; createdAt: number; description: string; category: CategoryId; paid: number; share: number; effect: number }
  | { kind: 'payment'; id: string; date: string; createdAt: number; other: string; direction: 'sent' | 'received'; amount: number; effect: number };

/**
 * Every expense and payment that touched someone, oldest first, with what
 * each did to their balance. The effects add up to the balance exactly:
 * the answer to "why do I owe this?".
 */
export function statementFor(group: Group, memberId: string): StatementLine[] {
  const lines: StatementLine[] = [];
  for (const expense of group.expenses) {
    const paid = expense.paidBy === memberId ? expense.amount : 0;
    const share = expenseShares(expense)[memberId] ?? 0;
    if (paid === 0 && share === 0) continue;
    lines.push({ kind: 'expense', id: expense.id, date: expense.date, createdAt: expense.createdAt, description: expense.description, category: expense.category, paid, share, effect: paid - share });
  }
  for (const payment of group.payments) {
    if (payment.from === memberId) lines.push({ kind: 'payment', id: payment.id, date: payment.date, createdAt: payment.createdAt, other: payment.to, direction: 'sent', amount: payment.amount, effect: payment.amount });
    if (payment.to === memberId) lines.push({ kind: 'payment', id: payment.id, date: payment.date, createdAt: payment.createdAt, other: payment.from, direction: 'received', amount: payment.amount, effect: -payment.amount });
  }
  return lines.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

export type ExpenseFilter = { query: string; category: CategoryId | null };

/** The expenses whose description or note contains the query, ignoring case and accents, in a category if one is chosen. */
export function filterExpenses(expenses: Expense[], { query, category }: ExpenseFilter): Expense[] {
  const wanted = fold(query.trim());
  return expenses.filter(
    (expense) => (category === null || expense.category === category) && (wanted === '' || fold(`${expense.description} ${expense.note ?? ''}`).includes(wanted))
  );
}
