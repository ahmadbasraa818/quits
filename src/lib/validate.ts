import { CATEGORIES } from './categories';
import { isValidDate } from './dates';
import { parseRateValue } from './fx';
import { MAX_MEMBERS } from './members';
import { isCurrencyCode, MAX_AMOUNT } from './money';
import type { Group } from './types';

/** The most expenses or payments a group brought in from outside may have. */
const MAX_ENTRIES = 5000;
const MAX_ITEMS = 100;

type Shape = Record<string, unknown>;
const isShape = (value: unknown): value is Shape => typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 64;
const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const isAmount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_AMOUNT;
const isTime = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isDate = (value: unknown): value is string => typeof value === 'string' && isValidDate(value);
const optional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value);
const categories = new Set<string>(CATEGORIES.map((category) => category.id));

function isSplit(value: unknown, members: Set<string>): boolean {
  if (!isShape(value)) return false;
  const people = (ids: unknown) => Array.isArray(ids) && ids.every((id) => members.has(id as string)) && new Set(ids).size === ids.length;
  const byPerson = (record: unknown, check: (value: unknown) => boolean) => isShape(record) && Object.entries(record).every(([id, amount]) => members.has(id) && check(amount));
  switch (value.kind) {
    case 'equal':
      return people(value.among);
    case 'shares':
      return byPerson(value.shares, (share) => Number.isSafeInteger(share) && (share as number) >= 0 && (share as number) <= 1000);
    case 'exact':
      return byPerson(value.amounts, isAmount);
    case 'items':
      return (
        Array.isArray(value.items) &&
        value.items.length <= MAX_ITEMS &&
        value.items.every((item) => isShape(item) && isId(item.id) && isText(item.label, 40) && isAmount(item.amount) && people(item.among)) &&
        isAmount(value.extras)
      );
    default:
      return false;
  }
}

/**
 * The group, if what came in from outside (a shared link, a backup) really is
 * one: every field the right type and within bounds, every person a split or
 * payment names in the group, and "you" one of them. Null otherwise, so a
 * damaged or doctored file can't put the app in a state it can't show.
 */
export function validateGroup(value: unknown): Group | null {
  if (!isShape(value) || !isId(value.id) || !isText(value.name, 40) || !isCurrencyCode(value.currency) || !isTime(value.createdAt)) return null;
  if (!optional(value.updatedAt, isTime) || !optional(value.origin, isId)) return null;
  const { members, expenses, payments } = value;
  if (!Array.isArray(members) || members.length === 0 || members.length > MAX_MEMBERS) return null;
  if (!members.every((member) => isShape(member) && isId(member.id) && isText(member.name, 24) && Number.isSafeInteger(member.tone) && optional(member.left, (left) => typeof left === 'boolean'))) return null;
  const ids = new Set(members.map((member) => member.id as string));
  if (ids.size !== members.length || !ids.has(value.me as string)) return null;
  if (!Array.isArray(expenses) || expenses.length > MAX_ENTRIES || !Array.isArray(payments) || payments.length > MAX_ENTRIES) return null;
  const goodExpense = (expense: unknown) =>
    isShape(expense) &&
    isId(expense.id) &&
    isText(expense.description, 60) &&
    isAmount(expense.amount) &&
    ids.has(expense.paidBy as string) &&
    isSplit(expense.split, ids) &&
    categories.has(expense.category as string) &&
    isDate(expense.date) &&
    isTime(expense.createdAt) &&
    optional(expense.updatedAt, isTime) &&
    optional(expense.note, (note) => isText(note, 200)) &&
    optional(
      expense.original,
      (original) =>
        isShape(original) &&
        isAmount(original.amount) &&
        isCurrencyCode(original.currency) &&
        isShape(original.rate) &&
        isCurrencyCode(original.rate.base) &&
        typeof original.rate.value === 'string' &&
        parseRateValue(original.rate.value) === original.rate.value
    );
  const goodPayment = (payment: unknown) =>
    isShape(payment) &&
    isId(payment.id) &&
    ids.has(payment.from as string) &&
    ids.has(payment.to as string) &&
    payment.from !== payment.to &&
    isAmount(payment.amount) &&
    isDate(payment.date) &&
    isTime(payment.createdAt) &&
    optional(payment.note, (note) => isText(note, 80));
  if (!expenses.every(goodExpense) || !payments.every(goodPayment)) return null;
  return value as unknown as Group;
}
