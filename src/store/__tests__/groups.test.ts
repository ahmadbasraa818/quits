import { useGroups } from '../groups';
import { summarise } from '../summary';

const japan = () => useGroups.getState().groups.find((group) => group.id === 'demo_japan')!;

describe('the groups store', () => {
  beforeEach(() => useGroups.getState().resetDemo());

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
  });
});
