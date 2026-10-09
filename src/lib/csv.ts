import { categoryOf } from './categories';
import { quoteOf } from './fx';
import { toInputString } from './money';
import { expenseShares } from './split';
import { fold } from './text';
import type { Group } from './types';

/** Excel reads a file as UTF-8, names like Chloë and symbols like ¥ intact, only when it starts with this mark. */
const BYTE_ORDER_MARK = '﻿';

/**
 * A field as CSV writes it, quoted where it must be. Text that a
 * spreadsheet would run as a formula (=, +, -, @ first) gets a leading
 * apostrophe, so a description can't become one.
 */
function field(value: string, text = true): string {
  const safe = text && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) || safe !== safe.trim() ? `"${safe.replace(/"/g, '""')}"` : safe;
}

type Row = { date: string; createdAt: number; cells: string[] };

/**
 * A group as a spreadsheet: every expense and payment, oldest first, each
 * with what it did to everyone's balance in a column per person. A last row
 * adds those columns up to where everyone stands now.
 */
export function groupCsv(group: Group): string {
  const money = (minor: number) => field(toInputString(minor, group.currency), false);
  const people = group.members.map((member) => member.id);
  const nameOf = (id: string) => group.members.find((member) => member.id === id)?.name ?? '?';
  const totals = new Map(people.map((id) => [id, 0]));
  const effects = (change: Record<string, number>) =>
    people.map((id) => {
      totals.set(id, totals.get(id)! + (change[id] ?? 0));
      return money(change[id] ?? 0);
    });

  const rows: Row[] = [
    ...group.expenses.map((expense) => {
      const shares = expenseShares(expense);
      const change = Object.fromEntries(people.map((id) => [id, (expense.paidBy === id ? expense.amount : 0) - (shares[id] ?? 0)]));
      const original = expense.original;
      const rate = original ? `1 ${original.rate.base} = ${original.rate.value} ${quoteOf(original.rate, original.currency, group.currency)}` : '';
      return {
        date: expense.date,
        createdAt: expense.createdAt,
        cells: [
          expense.date,
          'Expense',
          field(expense.description),
          field(categoryOf(expense.category).label),
          field(nameOf(expense.paidBy)),
          money(expense.amount),
          original ? field(toInputString(original.amount, original.currency), false) : '',
          original ? original.currency : '',
          field(rate),
          ...effects(change),
          field(expense.note ?? ''),
        ],
      };
    }),
    ...group.payments.map((payment) => ({
      date: payment.date,
      createdAt: payment.createdAt,
      cells: [
        payment.date,
        'Payment',
        field(`${nameOf(payment.from)} paid ${nameOf(payment.to)}`),
        '',
        field(nameOf(payment.from)),
        money(payment.amount),
        '',
        '',
        '',
        ...effects({ [payment.from]: payment.amount, [payment.to]: -payment.amount }),
        field(payment.note ?? ''),
      ],
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  const header = ['Date', 'Type', 'Description', 'Category', 'Paid by', `Amount (${group.currency})`, 'Paid in', 'Currency paid in', 'Rate', ...people.map((id) => field(nameOf(id))), 'Note'];
  const balance = ['', 'Balance', '', '', '', '', '', '', '', ...people.map((id) => money(totals.get(id)!)), ''];
  return BYTE_ORDER_MARK + [header, ...rows.map((row) => row.cells), balance].map((cells) => cells.join(',')).join('\r\n') + '\r\n';
}

/** "quits-japan-trip-2026-10-09.csv". */
export function csvFileName(group: Pick<Group, 'name'>, today: string): string {
  const slug =
    fold(group.name)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || 'group';
  return `quits-${slug}-${today}.csv`;
}
