import { addDays, localDate, parseLocalDate } from './dates';
import type { Expense, Group } from './types';

/** How often an expense comes round again. */
export const REPEAT_EVERY = ['week', 'month', 'year'] as const;
export type RepeatEvery = (typeof REPEAT_EVERY)[number];

/**
 * An expense that comes round again: rent, a subscription, a weekly shop.
 * The schedule lives on the newest expense in the series. `day` is the day
 * of the month it falls on, kept so the 31st comes back after a short month.
 */
export type Repeat = { every: RepeatEvery; day?: number };

/** The most of one series added at once, so a long time away can't flood a group. */
export const MAX_CATCH_UP = 60;

/** A schedule that starts on this date. */
export function repeatFrom(every: RepeatEvery, date: string): Repeat {
  return every === 'week' ? { every } : { every, day: parseLocalDate(date).getDate() };
}

/** When it's next due: a week on, or the same day next month or year, or that month's last day if it's shorter. */
export function nextDate(date: string, repeat: Repeat): string {
  if (repeat.every === 'week') return addDays(date, 7);
  const current = parseLocalDate(date);
  const first = new Date(current.getFullYear(), current.getMonth() + (repeat.every === 'month' ? 1 : 12), 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return localDate(new Date(first.getFullYear(), first.getMonth(), Math.min(repeat.day ?? current.getDate(), last)));
}

/** "Every week", "Every month", "Every year". */
export const repeatLabel = (repeat: Repeat) => `Every ${repeat.every}`;

function withoutRepeat(expense: Expense): Expense {
  const copy = { ...expense };
  delete copy.repeat;
  return copy;
}

/**
 * Adds every repeat that has come due by `today`, a YYYY-MM-DD date: each a
 * copy of the one before on its own date, the newest taking the schedule
 * on. Nothing due, and the very same group comes back.
 */
export function catchUp(group: Group, today: string, newId: () => string, now: number): { group: Group; added: Expense[] } {
  const added: Expense[] = [];
  const expenses = group.expenses.map((expense) => {
    const { repeat } = expense;
    if (!repeat) return expense;
    const copies: Expense[] = [];
    for (let due = nextDate(expense.date, repeat); due <= today && copies.length < MAX_CATCH_UP; due = nextDate(due, repeat)) {
      const copy: Expense = { ...withoutRepeat(expense), id: newId(), date: due, createdAt: now + added.length + copies.length };
      delete copy.updatedAt;
      copies.push(copy);
    }
    if (copies.length === 0) return expense;
    copies[copies.length - 1] = { ...copies[copies.length - 1], repeat };
    added.push(...copies);
    return withoutRepeat(expense);
  });
  return added.length === 0 ? { group, added } : { group: { ...group, expenses: [...expenses, ...added], updatedAt: now }, added };
}
