import { demoGroups } from '@/store/demo';

import { likelyCurrency, peopleFor } from '../expenses';
import type { Expense, Group } from '../types';

const [japan] = demoGroups(new Date(2026, 9, 4));
const paidIn = (currency: 'JPY' | 'GBP' | 'EUR', createdAt: number): Expense => ({
  id: `e${createdAt}`,
  description: 'x',
  amount: 100,
  original: currency === 'GBP' ? undefined : { amount: 100, currency, rate: { base: 'GBP', value: '2' } },
  paidBy: 'you',
  split: { kind: 'equal', among: ['you'] },
  category: 'other',
  date: '2026-10-04',
  createdAt,
});
const poundGroup = (expenses: Expense[]): Group => ({ ...japan, currency: 'GBP', expenses });

describe('likelyCurrency', () => {
  it('starts in the group’s currency', () => {
    expect(likelyCurrency(poundGroup([]))).toBe('GBP');
  });

  it('follows what most of the last five expenses were paid in', () => {
    expect(likelyCurrency(poundGroup([paidIn('JPY', 1), paidIn('JPY', 2), paidIn('GBP', 3)]))).toBe('JPY');
    // Older expenses don't count once there are five newer ones.
    expect(likelyCurrency(poundGroup([paidIn('JPY', 1), paidIn('JPY', 2), paidIn('JPY', 3), ...[4, 5, 6, 7, 8].map((t) => paidIn('EUR', t))]))).toBe('EUR');
  });

  it('settles a tie on the group’s currency', () => {
    expect(likelyCurrency(poundGroup([paidIn('JPY', 1), paidIn('GBP', 2)]))).toBe('GBP');
  });

  it('keeps the demo trip in yen, despite its passes bought in pounds', () => {
    expect(likelyCurrency(japan)).toBe('JPY');
  });
});

describe('peopleFor', () => {
  const withBenGone: Group = { ...japan, members: japan.members.map((member) => (member.id === 'ben' ? { ...member, left: true } : member)) };

  it('leaves out people who have left from a new expense', () => {
    expect(peopleFor(withBenGone, undefined).map((member) => member.id)).toEqual(['you', 'aiko', 'chloe', 'dev']);
  });

  it('keeps them on an expense they were already part of', () => {
    const shinkansen = japan.expenses.find((expense) => expense.description === 'Shinkansen to Kyoto');
    expect(peopleFor(withBenGone, shinkansen).map((member) => member.id)).toContain('ben');
  });
});
