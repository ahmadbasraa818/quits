import { addDays } from '@/lib/dates';
import type { Group } from '@/lib/types';

import { demoGroups } from '../demo';
import { useGroups } from '../groups';
import { summarise } from '../summary';

const japan = () => useGroups.getState().groups.find((group) => group.id === 'demo_japan')!;

describe('the groups store', () => {
  beforeEach(() => useGroups.getState().replaceAll(demoGroups()));

  it('starts with the demo groups', () => {
    expect(useGroups.getState().groups.map((group) => group.name)).toEqual(['Japan trip', 'Flat 4B', 'Brighton day trip']);
  });

  it('adds an expense and moves the balances', () => {
    const before = summarise(japan()).balance;
    useGroups.getState().addExpense('demo_japan', {
        description: 'Karaoke',
        amount: 5000,
        paidBy: 'aiko',
        split: { kind: 'equal', among: ['you', 'aiko'] },
        category: 'fun',
      date: '2026-10-03',
    });
    const after = summarise(japan()).balance;
    expect(after.aiko - before.aiko).toBe(2500);
    expect(after.you - before.you).toBe(-2500);
  });

  it('edits an expense in place', () => {
    const expense = japan().expenses[0];
    useGroups.getState().updateExpense('demo_japan', expense.id, { ...expense, description: 'Flat in Shinjuku' });
    expect(japan().expenses[0]).toMatchObject({ id: expense.id, description: 'Flat in Shinjuku' });
  });

  it('deletes an expense and can bring it back', () => {
    const expense = japan().expenses[1];
    const removed = useGroups.getState().removeExpense('demo_japan', expense.id);
    expect(japan().expenses.some((item) => item.id === expense.id)).toBe(false);
    useGroups.getState().restoreExpense('demo_japan', removed!);
    useGroups.getState().restoreExpense('demo_japan', removed!);
    expect(japan().expenses.filter((item) => item.id === expense.id)).toHaveLength(1);
  });

  it('settles a group once every suggested payment is recorded', () => {
    const { transfers } = summarise(japan()).settlement;
    expect(transfers.length).toBe(4);
    for (const transfer of transfers) useGroups.getState().recordPayment('demo_japan', { ...transfer, date: '2026-10-03' });
    const summary = summarise(japan());
    expect(summary.settlement.transfers).toEqual([]);
    expect(Object.values(summary.balance).every((value) => value === 0)).toBe(true);
  });

  it('undoes a recorded payment', () => {
    const [first] = summarise(japan()).settlement.transfers;
    const id = useGroups.getState().recordPayment('demo_japan', { ...first, date: '2026-10-03' });
    useGroups.getState().removePayment('demo_japan', id);
    expect(summarise(japan()).settlement.transfers).toHaveLength(4);
  });

  it('creates a group with you in it, first in the list', () => {
    const id = useGroups.getState().createGroup({ name: 'Lisbon', currency: 'EUR', memberNames: ['Rui', 'Ana'] });
    const [group] = useGroups.getState().groups;
    expect(group).toMatchObject({ id, name: 'Lisbon', currency: 'EUR', me: 'you', expenses: [], payments: [] });
    expect(group.members.map((member) => member.name)).toEqual(['You', 'Rui', 'Ana']);
    expect(group.members.map((member) => member.tone)).toEqual([0, 1, 2]);
  });

  it('keeps an expense’s date and note, and stamps when it changed', () => {
    const id = useGroups.getState().addExpense('demo_japan', {
      description: 'Onsen',
      amount: 6000,
      paidBy: 'you',
      split: { kind: 'equal', among: ['you', 'ben'] },
      category: 'fun',
      date: '2026-09-30',
      note: 'Towels included',
    });
    const added = japan().expenses.find((expense) => expense.id === id)!;
    expect(added).toMatchObject({ date: '2026-09-30', note: 'Towels included' });
    expect(added.updatedAt).toBeUndefined();
    useGroups.getState().updateExpense('demo_japan', id, { ...added, note: undefined, date: '2026-10-01' });
    const edited = japan().expenses.find((expense) => expense.id === id)!;
    expect(edited.note).toBeUndefined();
    expect(edited.date).toBe('2026-10-01');
    expect(edited.updatedAt).toEqual(expect.any(Number));
  });
});

describe('editing a group', () => {
  beforeEach(() => useGroups.getState().replaceAll(demoGroups()));
  const everyone = (group: Group) => group.members.map((member) => ({ id: member.id, name: member.name, left: member.left }));

  it('renames the group and its people', () => {
    const group = japan();
    useGroups.getState().editGroup('demo_japan', {
      name: '  Japan, autumn ',
      currency: group.currency,
      members: everyone(group).map((member) => (member.id === 'dev' ? { ...member, name: 'Devraj' } : member)),
    });
    expect(japan().name).toBe('Japan, autumn');
    expect(japan().members.find((member) => member.id === 'dev')?.name).toBe('Devraj');
    expect(japan().updatedAt).toEqual(expect.any(Number));
  });

  it('adds people with a fresh colour', () => {
    const group = japan();
    useGroups.getState().editGroup('demo_japan', { name: group.name, currency: group.currency, members: [...everyone(group), { name: 'Emi' }] });
    const emi = japan().members.find((member) => member.name === 'Emi')!;
    expect(emi.id).toMatch(/^m_/);
    expect(emi.tone).toBe(5);
  });

  it('removes someone with no history, but keeps anyone with history as having left', () => {
    const id = useGroups.getState().createGroup({ name: 'Picnic', currency: 'GBP', memberNames: ['Sam', 'Jo'] });
    const picnic = () => useGroups.getState().groups.find((group) => group.id === id)!;
    const [, sam, jo] = picnic().members;
    useGroups.getState().addExpense(id, { description: 'Cake', amount: 1200, paidBy: sam.id, split: { kind: 'equal', among: ['you', sam.id] }, category: 'food', date: '2026-10-04' });
    useGroups.getState().editGroup(id, { name: 'Picnic', currency: 'GBP', members: [{ id: 'you', name: 'You' }] });
    expect(picnic().members.map((member) => [member.name, member.left])).toEqual([
      ['You', undefined],
      ['Sam', true],
    ]);
    expect(picnic().members.some((member) => member.id === jo.id)).toBe(false);
  });

  it('marks people as having left, and brings them back', () => {
    const group = japan();
    useGroups.getState().editGroup('demo_japan', { name: group.name, currency: group.currency, members: everyone(group).map((member) => (member.id === 'ben' ? { ...member, left: true } : member)) });
    expect(japan().members.find((member) => member.id === 'ben')?.left).toBe(true);
    useGroups.getState().editGroup('demo_japan', { name: group.name, currency: group.currency, members: everyone(japan()).map((member) => ({ ...member, left: false })) });
    expect(japan().members.find((member) => member.id === 'ben')?.left).toBeUndefined();
  });

  it('never lets you leave, or be renamed', () => {
    const group = japan();
    useGroups.getState().editGroup('demo_japan', { name: group.name, currency: group.currency, members: everyone(group).map((member) => (member.id === 'you' ? { ...member, name: 'Me', left: true } : member)) });
    expect(japan().members[0]).toEqual({ id: 'you', name: 'You', tone: 0 });
  });

  it('changes the currency only while the group is empty', () => {
    const group = japan();
    useGroups.getState().editGroup('demo_japan', { name: group.name, currency: 'GBP', members: everyone(group) });
    expect(japan().currency).toBe('JPY');
    const id = useGroups.getState().createGroup({ name: 'Paris', currency: 'GBP', memberNames: ['Léa'] });
    const paris = useGroups.getState().groups.find((item) => item.id === id)!;
    useGroups.getState().editGroup(id, { name: 'Paris', currency: 'EUR', members: everyone(paris) });
    expect(useGroups.getState().groups.find((item) => item.id === id)?.currency).toBe('EUR');
  });

  it('deletes a group, and puts it back where it was', () => {
    const deleted = useGroups.getState().deleteGroup('demo_flat');
    expect(deleted?.index).toBe(1);
    expect(useGroups.getState().groups.map((group) => group.id)).toEqual(['demo_japan', 'demo_brighton']);
    useGroups.getState().restoreGroup(deleted!.group, deleted!.index);
    useGroups.getState().restoreGroup(deleted!.group, deleted!.index);
    expect(useGroups.getState().groups.map((group) => group.id)).toEqual(['demo_japan', 'demo_flat', 'demo_brighton']);
    expect(useGroups.getState().deleteGroup('nope')).toBeUndefined();
  });
});

describe('how people get paid', () => {
  beforeEach(() => useGroups.getState().replaceAll(demoGroups()));
  const ben = () => japan().members.find((member) => member.id === 'ben')!;
  const paypal = { kind: 'paypal', handle: 'bensmith' } as const;

  it('is set for one person, and can be undone', () => {
    expect(useGroups.getState().setPayMethods('demo_japan', 'ben', [paypal])).toEqual([]);
    expect(ben().pay).toEqual([paypal]);
    expect(japan().members.filter((member) => member.pay)).toHaveLength(1);
    const before = useGroups.getState().setPayMethods('demo_japan', 'ben', []);
    expect(ben()).not.toHaveProperty('pay');
    useGroups.getState().setPayMethods('demo_japan', 'ben', before);
    expect(ben().pay).toEqual([paypal]);
  });

  it('stays through editing the group, and goes with a shared copy', () => {
    useGroups.getState().setPayMethods('demo_japan', 'ben', [paypal]);
    const group = japan();
    useGroups.getState().editGroup('demo_japan', { name: 'Japan 2026', currency: group.currency, members: group.members.map(({ id, name, left }) => ({ id, name, left })) });
    expect(ben().pay).toEqual([paypal]);
    expect(useGroups.getState().prepareShare('demo_japan', 'Ahmad')?.members.find((member) => member.id === 'ben')?.pay).toEqual([paypal]);
  });
});

describe('archiving', () => {
  beforeEach(() => useGroups.getState().replaceAll(demoGroups()));

  it('puts a group away and brings it back', () => {
    useGroups.getState().setArchived('demo_japan', true);
    expect(japan().archived).toBe(true);
    useGroups.getState().setArchived('demo_japan', false);
    expect(japan()).not.toHaveProperty('archived');
  });

  it('is the sharer’s own business: a copy from a link isn’t archived, and an update keeps yours', () => {
    useGroups.getState().setArchived('demo_japan', true);
    const id = useGroups.getState().importGroup(japan(), 'aiko');
    const copy = () => useGroups.getState().groups.find((group) => group.id === id)!;
    expect(copy().archived).toBeUndefined();
    useGroups.getState().setArchived(id, true);
    useGroups.getState().replaceGroup(id, { ...japan(), archived: undefined });
    expect(copy().archived).toBe(true);
  });
});

describe('repeating expenses', () => {
  beforeEach(() => useGroups.getState().replaceAll(demoGroups()));
  const flat = () => useGroups.getState().groups.find((group) => group.id === 'demo_flat')!;

  it('adds nothing, and saves nothing, when none are due', () => {
    const before = useGroups.getState().groups;
    expect(useGroups.getState().catchUpRepeats()).toBe(0);
    expect(useGroups.getState().groups).toBe(before);
  });

  it('adds the flat’s broadband each month it comes due', () => {
    const broadband = flat().expenses.find((expense) => expense.description === 'Broadband')!;
    const inTwoMonths = addDays(broadband.date, 62);
    expect(useGroups.getState().catchUpRepeats(inTwoMonths)).toBe(2);
    const all = flat().expenses.filter((expense) => expense.description === 'Broadband');
    expect(all).toHaveLength(3);
    expect(all.filter((expense) => expense.repeat)).toHaveLength(1);
    expect(useGroups.getState().catchUpRepeats(inTwoMonths)).toBe(0);
  });
});
