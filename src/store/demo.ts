import { daysAgo } from '@/lib/dates';
import { convert, Rate } from '@/lib/fx';
import type { Expense, Group, Payment } from '@/lib/types';

/**
 * The demo changes with the app, in step with the saved data's version: 2
 * added JR Passes paid in pounds to the Japan trip, 3 an itemised bill.
 */
export const DEMO_VERSION = 3;

/** An expense `days` ago, and the demo version that first had it. */
type Draft = Omit<Expense, 'id' | 'createdAt' | 'date'> & { days: number; since?: number };
type PaymentDraft = Omit<Payment, 'id' | 'createdAt' | 'date'> & { days: number };

function build(prefix: string, base: Omit<Group, 'expenses' | 'payments'>, drafts: Draft[], payments: PaymentDraft[], now: Date, version: number): Group {
  return {
    ...base,
    // Ids come from each draft's place in the full list, so they stay the same in every version.
    expenses: drafts.flatMap(({ days, since = 1, ...draft }, index) =>
      since > version ? [] : [{ ...draft, id: `${prefix}_e${index}`, date: daysAgo(days, now), createdAt: now.getTime() - days * 86_400_000 + index }]
    ),
    payments: payments.map(({ days, ...payment }, index) => ({
      ...payment,
      id: `${prefix}_p${index}`,
      date: daysAgo(days, now),
      createdAt: now.getTime() - days * 86_400_000 + index,
    })),
  };
}

const jrRate: Rate = { base: 'GBP', value: '207.31' };

/** The groups a first-time visitor sees: a trip, a flat, and one already settled. */
export function demoGroups(now = new Date(), version = DEMO_VERSION): Group[] {
  const japan = build(
    'japan',
    {
      id: 'demo_japan',
      name: 'Japan trip',
      currency: 'JPY',
      me: 'you',
      createdAt: now.getTime() - 40 * 86_400_000,
      members: [
        { id: 'you', name: 'You', tone: 0 },
        { id: 'aiko', name: 'Aiko', tone: 1 },
        { id: 'ben', name: 'Ben', tone: 2 },
        { id: 'chloe', name: 'Chloe', tone: 3 },
        { id: 'dev', name: 'Dev', tone: 4 },
      ],
    },
    [
      { days: 34, description: 'Apartment in Shinjuku', amount: 168000, paidBy: 'you', category: 'stay', split: { kind: 'equal', among: ['you', 'aiko', 'ben', 'chloe', 'dev'] } },
      { days: 33, description: 'teamLab Planets', amount: 19200, paidBy: 'aiko', category: 'fun', split: { kind: 'equal', among: ['you', 'aiko', 'ben', 'chloe', 'dev'] } },
      { days: 33, description: 'Ichiran ramen', amount: 7480, paidBy: 'chloe', category: 'food', split: { kind: 'equal', among: ['you', 'ben', 'chloe', 'dev'] } },
      { days: 32, description: 'Izakaya in Ebisu', amount: 23600, paidBy: 'you', category: 'drinks', split: { kind: 'exact', amounts: { you: 5200, aiko: 4800, ben: 6100, chloe: 3500, dev: 4000 } } },
      { days: 31, description: 'Akihabara arcade', amount: 6000, paidBy: 'ben', category: 'fun', split: { kind: 'equal', among: ['you', 'ben', 'dev'] } },
      { days: 30, description: 'Shinkansen to Kyoto', amount: 69750, paidBy: 'ben', category: 'transport', split: { kind: 'equal', among: ['you', 'aiko', 'ben', 'chloe', 'dev'] } },
      { days: 29, description: 'Ryokan, two nights', amount: 126000, paidBy: 'dev', category: 'stay', split: { kind: 'shares', shares: { you: 2, aiko: 2, ben: 2, chloe: 1, dev: 2 } } },
      { days: 28, description: 'Deer crackers in Nara', amount: 1000, paidBy: 'dev', category: 'other', split: { kind: 'equal', among: ['you', 'aiko', 'ben', 'chloe', 'dev'] } },
      { days: 28, description: 'Rain jackets', amount: 8980, paidBy: 'chloe', category: 'shopping', split: { kind: 'exact', amounts: { chloe: 4490, dev: 4490 } } },
      { days: 27, description: 'Suica top-ups', amount: 10000, paidBy: 'aiko', category: 'transport', split: { kind: 'equal', among: ['aiko', 'chloe'] } },
      {
        days: 38,
        since: 2,
        description: 'JR Passes, bought at home',
        amount: convert(131000, 'GBP', 'JPY', jrRate),
        original: { amount: 131000, currency: 'GBP', rate: jrRate },
        paidBy: 'ben',
        category: 'transport',
        split: { kind: 'equal', among: ['you', 'aiko', 'ben', 'chloe', 'dev'] },
      },
      {
        days: 29,
        since: 3,
        description: 'Okonomiyaki in Dotonbori',
        amount: 9750,
        paidBy: 'chloe',
        category: 'food',
        split: {
          kind: 'items',
          items: [
            { id: 'okonomi_1', label: 'Pork okonomiyaki', amount: 1450, among: ['you'] },
            { id: 'okonomi_2', label: 'Seafood okonomiyaki', amount: 1650, among: ['aiko'] },
            { id: 'okonomi_3', label: 'Modan-yaki', amount: 1550, among: ['ben'] },
            { id: 'okonomi_4', label: 'Cheese okonomiyaki', amount: 1500, among: ['chloe'] },
            { id: 'okonomi_5', label: 'Yakisoba to share', amount: 1200, among: ['you', 'aiko', 'ben', 'chloe', 'dev'] },
            { id: 'okonomi_6', label: 'Beers', amount: 2400, among: ['you', 'ben', 'dev'] },
          ],
          extras: 0,
        },
      },
    ],
    [],
    now,
    version
  );

  const flat = build(
    'flat',
    {
      id: 'demo_flat',
      name: 'Flat 4B',
      currency: 'GBP',
      me: 'you',
      createdAt: now.getTime() - 60 * 86_400_000,
      members: [
        { id: 'you', name: 'You', tone: 0 },
        { id: 'sam', name: 'Sam', tone: 5 },
        { id: 'priya', name: 'Priya', tone: 6 },
      ],
    },
    [
      { days: 12, description: 'Energy bill', amount: 14230, paidBy: 'you', category: 'bills', split: { kind: 'equal', among: ['you', 'sam', 'priya'] } },
      { days: 10, description: 'Broadband', amount: 3200, paidBy: 'sam', category: 'bills', split: { kind: 'equal', among: ['you', 'sam', 'priya'] } },
      { days: 6, description: 'Big shop', amount: 8645, paidBy: 'priya', category: 'shopping', split: { kind: 'equal', among: ['you', 'sam', 'priya'] } },
      { days: 4, description: 'Cleaning things', amount: 1820, paidBy: 'you', category: 'home', split: { kind: 'equal', among: ['you', 'sam', 'priya'] } },
      { days: 1, description: 'Pizza night', amount: 3660, paidBy: 'priya', category: 'food', split: { kind: 'equal', among: ['you', 'sam', 'priya'] } },
    ],
    [],
    now,
    version
  );

  const brighton = build(
    'brighton',
    {
      id: 'demo_brighton',
      name: 'Brighton day trip',
      currency: 'GBP',
      me: 'you',
      createdAt: now.getTime() - 90 * 86_400_000,
      members: [
        { id: 'you', name: 'You', tone: 0 },
        { id: 'mia', name: 'Mia', tone: 7 },
        { id: 'tom', name: 'Tom', tone: 2 },
      ],
    },
    [
      { days: 75, description: 'Train tickets', amount: 6150, paidBy: 'mia', category: 'transport', split: { kind: 'equal', among: ['you', 'mia', 'tom'] } },
      { days: 75, description: 'Fish and chips', amount: 2700, paidBy: 'you', category: 'food', split: { kind: 'equal', among: ['you', 'mia', 'tom'] } },
    ],
    [
      { days: 74, from: 'tom', to: 'mia', amount: 2950 },
      { days: 74, from: 'you', to: 'mia', amount: 250 },
    ],
    now,
    version
  );

  return [japan, flat, brighton];
}
