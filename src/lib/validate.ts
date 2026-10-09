import { CATEGORIES } from './categories';
import { isValidDate } from './dates';
import { parseRateValue } from './fx';
import { MAX_MEMBERS } from './members';
import { isCurrencyCode, MAX_AMOUNT } from './money';
import { isPayMethod, MAX_PAY_METHODS } from './pay';
import { REPEAT_EVERY, type RepeatEvery } from './repeat';
import type { Group } from './types';

/** The most expenses or payments a group brought in from outside may have. */
const MAX_ENTRIES = 5000;
const MAX_ITEMS = 100;

/**
 * Whose data it is. Data from other people (a shared link) is held to every
 * limit, so a crafted one can't swamp the app. The person's own data (what
 * the app saved, or their backup) only has to be sound: a flat that has kept
 * Quits for years may pass any count the app never set a limit on.
 */
export type Source = 'outside' | 'own';

type Shape = Record<string, unknown>;
const isShape = (value: unknown): value is Shape => typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 64;
const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const isAmount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_AMOUNT;
const isTime = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isDate = (value: unknown): value is string => typeof value === 'string' && isValidDate(value);
const optional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value);
const categories = new Set<string>(CATEGORIES.map((category) => category.id));
const isRepeat = (value: unknown) =>
  isShape(value) &&
  REPEAT_EVERY.includes(value.every as RepeatEvery) &&
  optional(value.day, (day) => Number.isSafeInteger(day) && (day as number) >= 1 && (day as number) <= 31);

function isSplit(value: unknown, members: Set<string>, cap: (limit: number) => number): boolean {
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
        value.items.length <= cap(MAX_ITEMS) &&
        value.items.every((item) => isShape(item) && isId(item.id) && isText(item.label, cap(40)) && isAmount(item.amount) && people(item.among)) &&
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
export function validateGroup(value: unknown, source: Source = 'outside'): Group | null {
  const cap = (limit: number) => (source === 'outside' ? limit : Infinity);
  if (!isShape(value) || !isId(value.id) || !isText(value.name, cap(40)) || !isCurrencyCode(value.currency) || !isTime(value.createdAt)) return null;
  if (!optional(value.updatedAt, isTime) || !optional(value.origin, isId) || !optional(value.archived, (archived) => typeof archived === 'boolean')) return null;
  const { members, expenses, payments } = value;
  if (!Array.isArray(members) || members.length === 0 || members.length > cap(MAX_MEMBERS)) return null;
  const goodPay = (pay: unknown) => Array.isArray(pay) && pay.length <= cap(MAX_PAY_METHODS) && pay.every(isPayMethod);
  const goodMember = (member: unknown) =>
    isShape(member) &&
    isId(member.id) &&
    isText(member.name, cap(24)) &&
    Number.isSafeInteger(member.tone) &&
    optional(member.left, (left) => typeof left === 'boolean') &&
    optional(member.pay, goodPay);
  if (!members.every(goodMember)) return null;
  const ids = new Set(members.map((member) => member.id as string));
  if (ids.size !== members.length || !ids.has(value.me as string)) return null;
  if (!Array.isArray(expenses) || expenses.length > cap(MAX_ENTRIES) || !Array.isArray(payments) || payments.length > cap(MAX_ENTRIES)) return null;
  const goodExpense = (expense: unknown) =>
    isShape(expense) &&
    isId(expense.id) &&
    isText(expense.description, cap(60)) &&
    isAmount(expense.amount) &&
    ids.has(expense.paidBy as string) &&
    isSplit(expense.split, ids, cap) &&
    categories.has(expense.category as string) &&
    isDate(expense.date) &&
    isTime(expense.createdAt) &&
    optional(expense.updatedAt, isTime) &&
    optional(expense.note, (note) => isText(note, cap(200))) &&
    optional(expense.repeat, isRepeat) &&
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
    optional(payment.note, (note) => isText(note, cap(80)));
  if (!expenses.every(goodExpense) || !payments.every(goodPayment)) return null;
  return value as unknown as Group;
}
