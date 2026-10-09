import * as fc from 'fast-check';

import { addDays, localDate } from '../dates';
import { catchUp, MAX_CATCH_UP, nextDate, type Repeat, repeatFrom, repeatLabel, REPEAT_EVERY } from '../repeat';
import type { Expense, Group } from '../types';

const flat = (expenses: Expense[]): Group => ({
  id: 'g_flat',
  name: 'Flat',
  currency: 'GBP',
  me: 'you',
  members: [
    { id: 'you', name: 'You', tone: 0 },
    { id: 'sam', name: 'Sam', tone: 1 },
  ],
  expenses,
  payments: [],
  createdAt: 0,
});

const rent = (date: string, repeat?: Repeat): Expense => ({
  id: 'rent',
  description: 'Rent',
  amount: 120000,
  paidBy: 'sam',
  split: { kind: 'equal', among: ['you', 'sam'] },
  category: 'home',
  date,
  note: 'Standing order',
  createdAt: 1,
  updatedAt: 2,
  ...(repeat ? { repeat } : {}),
});

let count = 0;
const newId = () => `e${(count += 1)}`;

describe('when a repeat is next due', () => {
  it('comes a week on', () => {
    expect(nextDate('2026-10-09', { every: 'week' })).toBe('2026-10-16');
    expect(nextDate('2026-12-29', { every: 'week' })).toBe('2027-01-05');
  });

  it('comes on the same day next month, or the last day of a shorter one', () => {
    const monthly = repeatFrom('month', '2026-01-31');
    expect(monthly).toEqual({ every: 'month', day: 31 });
    expect(nextDate('2026-01-31', monthly)).toBe('2026-02-28');
    // Back to the 31st after February, not stuck on the 28th.
    expect(nextDate('2026-02-28', monthly)).toBe('2026-03-31');
    expect(nextDate('2027-12-31', monthly)).toBe('2028-01-31');
    expect(nextDate('2028-01-31', monthly)).toBe('2028-02-29');
  });

  it('comes on the same day next year, the 28th when there’s no 29th', () => {
    const yearly = repeatFrom('year', '2028-02-29');
    expect(nextDate('2028-02-29', yearly)).toBe('2029-02-28');
    expect(nextDate('2031-02-28', yearly)).toBe('2032-02-29');
  });

  it('is never early, and never skips a whole period', () => {
    const day = fc.date({ min: new Date(2000, 0, 1), max: new Date(2090, 11, 31), noInvalidDate: true }).map(localDate);
    fc.assert(
      fc.property(day, fc.constantFrom(...REPEAT_EVERY), (date, every) => {
        const next = nextDate(date, repeatFrom(every, date));
        const [shortest, longest] = { week: [7, 7], month: [28, 31], year: [365, 366] }[every];
        expect(next > addDays(date, shortest - 1)).toBe(true);
        expect(next <= addDays(date, longest)).toBe(true);
      })
    );
  });

  it('is described', () => {
    expect(repeatLabel({ every: 'month', day: 3 })).toBe('Every month');
  });
});

describe('catching up', () => {
  it('adds nothing before one is due, and gives back the same group', () => {
    const group = flat([rent('2026-10-01', repeatFrom('month', '2026-10-01'))]);
    const result = catchUp(group, '2026-10-31', newId, 5);
    expect(result.added).toEqual([]);
    expect(result.group).toBe(group);
  });

  it('adds each one that has come due, and moves the schedule to the newest', () => {
    const group = flat([rent('2026-08-01', repeatFrom('month', '2026-08-01'))]);
    const { group: after, added } = catchUp(group, '2026-10-09', newId, 1000);
    expect(added.map((expense) => expense.date)).toEqual(['2026-09-01', '2026-10-01']);
    expect(after.expenses.filter((expense) => expense.repeat).map((expense) => expense.date)).toEqual(['2026-10-01']);
    expect(after.expenses.find((expense) => expense.id === 'rent')).not.toHaveProperty('repeat');
    // Each is the same expense on another day, and new: no record of an edit it never had.
    expect(added[0]).toMatchObject({ description: 'Rent', amount: 120000, paidBy: 'sam', note: 'Standing order', split: { kind: 'equal', among: ['you', 'sam'] } });
    expect(added[0]).not.toHaveProperty('updatedAt');
    expect(new Set(added.map((expense) => expense.id)).size).toBe(2);
    expect(after.updatedAt).toBe(1000);
  });

  it('happens once: catching up again adds nothing', () => {
    const { group } = catchUp(flat([rent('2026-08-01', repeatFrom('month', '2026-08-01'))]), '2026-10-09', newId, 1);
    expect(catchUp(group, '2026-10-09', newId, 2).added).toEqual([]);
  });

  it('adds at most sixty at a time, and the rest the next time', () => {
    const first = catchUp(flat([rent('2024-01-01', { every: 'week' })]), '2026-10-09', newId, 1);
    expect(first.added).toHaveLength(MAX_CATCH_UP);
    const second = catchUp(first.group, '2026-10-09', newId, 2);
    expect(second.added.length).toBeGreaterThan(0);
    expect(second.added[0].date).toBe(addDays(first.added[MAX_CATCH_UP - 1].date, 7));
  });

  it('leaves one schedule per series, every copy due by today, in order', () => {
    // Within sixty weeks of today, so one catching up is enough.
    const day = fc.date({ min: new Date(2025, 8, 1), max: new Date(2026, 9, 9), noInvalidDate: true }).map(localDate);
    fc.assert(
      fc.property(day, fc.constantFrom(...REPEAT_EVERY), (start, every) => {
        const { group, added } = catchUp(flat([rent(start, repeatFrom(every, start))]), '2026-10-09', newId, 1);
        expect(group.expenses.filter((expense) => expense.repeat)).toHaveLength(1);
        const dates = added.map((expense) => expense.date);
        expect([...dates].sort()).toEqual(dates);
        for (const date of dates) expect(date <= '2026-10-09').toBe(true);
        expect(nextDate(group.expenses.find((expense) => expense.repeat)!.date, repeatFrom(every, start)) > '2026-10-09').toBe(true);
      })
    );
  });
});
