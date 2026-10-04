import * as fc from 'fast-check';

import { demoGroups } from '@/store/demo';

import { decodeGroup, encodeGroup, packText, shareLink } from '../share-link';
import type { Group } from '../types';
import { validateGroup } from '../validate';
import { groupArbitrary } from './arbitraries';

const groups = demoGroups(new Date(2026, 9, 4));
const [japan] = groups;
const asGroup = ({ ids, expenses, payments }: { ids: string[]; expenses: Group['expenses']; payments: Group['payments'] }): Group => ({
  id: 'g_test',
  name: 'Random',
  currency: 'GBP',
  me: ids[0],
  members: ids.map((id, tone) => ({ id, name: `Person ${id}`, tone })),
  expenses: expenses.map((expense, i) => ({ ...expense, id: `e${i}` })),
  payments: payments.map((payment, i) => ({ ...payment, id: `p${i}` })),
  createdAt: 0,
});

describe('shared links', () => {
  it('carry a group there and back unchanged', () => {
    for (const group of groups) expect(decodeGroup(encodeGroup(group))).toEqual(group);
  });

  it('carry any group there and back', () => {
    fc.assert(
      fc.property(groupArbitrary, (generated) => {
        const group = asGroup(generated);
        expect(decodeGroup(encodeGroup(group))).toEqual(group);
      })
    );
  });

  it('stay a sensible length for a real trip', () => {
    const link = shareLink(japan);
    expect(link.startsWith('https://ahmadbasraa818.github.io/quits/import#q1.')).toBe(true);
    expect(link.length).toBeLessThan(4000);
    expect(/^[A-Za-z0-9_-]+$/.test(link.split('#q1.')[1])).toBe(true);
  });

  it('turn away anything that isn’t a group', () => {
    expect(decodeGroup('')).toBeNull();
    expect(decodeGroup('q1.not-really-deflate')).toBeNull();
    expect(decodeGroup('q2.' + encodeGroup(japan).slice(3))).toBeNull();
    expect(decodeGroup(encodeGroup(japan).slice(0, 40))).toBeNull();
    const notAGroup = packText(JSON.stringify({ hello: 'world' }));
    expect(decodeGroup(notAGroup)).toBeNull();
  });

  it('refuse a link that unpacks to something enormous', () => {
    const bomb = packText(' '.repeat(5_000_000));
    expect(bomb.length).toBeLessThan(20_000);
    expect(decodeGroup(bomb)).toBeNull();
  });
});

describe('checking a group from outside', () => {
  it('accepts every demo group', () => {
    for (const group of groups) expect(validateGroup(group)).toBe(group);
  });

  const broken: [string, (group: Group) => unknown][] = [
    ['no members', (group) => ({ ...group, members: [] })],
    ['"you" not in the group', (group) => ({ ...group, me: 'nobody' })],
    ['two people with one id', (group) => ({ ...group, members: [...group.members, group.members[0]] })],
    ['a split naming a stranger', (group) => ({ ...group, expenses: [{ ...group.expenses[0], split: { kind: 'equal', among: ['stranger'] } }] })],
    ['an unknown kind of split', (group) => ({ ...group, expenses: [{ ...group.expenses[0], split: { kind: 'magic' } }] })],
    ['a negative amount', (group) => ({ ...group, expenses: [{ ...group.expenses[0], amount: -5 }] })],
    ['a fractional amount', (group) => ({ ...group, expenses: [{ ...group.expenses[0], amount: 1.5 }] })],
    ['a made-up date', (group) => ({ ...group, expenses: [{ ...group.expenses[0], date: '2026-02-30' }] })],
    ['an unknown currency', (group) => ({ ...group, currency: 'XYZ' })],
    ['a float for a rate', (group) => ({ ...group, expenses: [{ ...group.expenses[0], original: { amount: 100, currency: 'GBP', rate: { base: 'GBP', value: 207.31 } } }] })],
    ['someone paying themselves', (group) => ({ ...group, payments: [{ id: 'p', from: 'you', to: 'you', amount: 100, date: '2026-10-01', createdAt: 0 }] })],
    ['a name too long to show', (group) => ({ ...group, name: 'x'.repeat(500) })],
  ];
  it.each(broken)('turns away a group with %s', (_, breakIt) => {
    expect(validateGroup(breakIt(japan))).toBeNull();
  });
});
