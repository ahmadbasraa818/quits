import { demoGroups } from '@/store/demo';

import { activeMembers, hasHistory, MAX_MEMBERS, nameOf, namesProblem, nextTone, tonesFor } from '../members';

const [japan, , brighton] = demoGroups(new Date(2026, 9, 4));

describe('members', () => {
  it('calls the person using the app "You"', () => {
    expect(nameOf(japan, 'you')).toBe('You');
    expect(nameOf(japan, 'aiko')).toBe('Aiko');
    expect(nameOf(japan, 'nobody')).toBe('Someone');
  });

  it('sees anyone whose money moved through an expense or a payment', () => {
    expect(hasHistory(japan, 'chloe')).toBe(true);
    expect(hasHistory(brighton, 'tom')).toBe(true);
    const quiet = { ...japan, expenses: japan.expenses.filter((expense) => expense.paidBy !== 'aiko' && !JSON.stringify(expense.split).includes('aiko')) };
    expect(hasHistory(quiet, 'aiko')).toBe(false);
  });

  it('leaves people who have left out of new expenses', () => {
    const group = { ...japan, members: japan.members.map((member) => (member.id === 'ben' ? { ...member, left: true } : member)) };
    expect(activeMembers(group).map((member) => member.id)).toEqual(['you', 'aiko', 'chloe', 'dev']);
  });

  it('gives a new person the colour fewest people have', () => {
    expect(nextTone([{ tone: 0 }])).toBe(1);
    expect(nextTone([{ tone: 0 }, { tone: 1 }, { tone: 2 }])).toBe(3);
    expect(nextTone([0, 1, 2, 3, 4, 5, 6, 7].map((tone) => ({ tone })))).toBe(1);
    expect(tonesFor(9)).toEqual([1, 2, 3, 4, 5, 6, 7, 1, 2]);
    expect(tonesFor(2, [0, 1, 3])).toEqual([2, 4]);
  });

  it('asks for names that are filled in and tell people apart', () => {
    expect(namesProblem(['Aiko', 'Ben'])).toBeNull();
    expect(namesProblem(['Aiko', ' '])).toBe('Give everyone a name.');
    expect(namesProblem(['Aiko', 'aiko '])).toBe('There are two people called aiko. Add an initial to tell them apart.');
    expect(namesProblem(['you'])).toBe('“You” is taken: it’s what Quits calls you.');
    expect(namesProblem(Array.from({ length: MAX_MEMBERS }, (_, i) => `P${i}`))).toBe(`A group can have up to ${MAX_MEMBERS} people.`);
  });
});
