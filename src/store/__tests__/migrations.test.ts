import { demoGroups } from '../demo';
import { migrate, STORE_VERSION } from '../migrations';

const jrPass = (groups: { id: string; expenses: { description: string }[] }[]) =>
  groups.find((group) => group.id === 'demo_japan')?.expenses.some((expense) => expense.description === 'JR Passes, bought at home');

describe('migrating saved data', () => {
  it('is at version 3', () => {
    expect(STORE_VERSION).toBe(3);
  });

  it('gives a version 2 demo no one touched the itemised bill too', () => {
    const saved = { groups: demoGroups(new Date(2026, 0, 15), 2) };
    const okonomiyaki = (groups: typeof saved.groups) => groups[0].expenses.some((expense) => expense.split.kind === 'items');
    expect(okonomiyaki(saved.groups)).toBe(false);
    expect(okonomiyaki(migrate(saved, 2).groups)).toBe(true);
  });

  it('gives a version 1 demo no one touched the new demo', () => {
    // Saved long ago: the dates differ from today's demo, the content doesn't.
    const saved = { groups: demoGroups(new Date(2026, 0, 15), 1) };
    expect(jrPass(saved.groups)).toBe(false);
    expect(jrPass(migrate(saved, 1).groups)).toBe(true);
  });

  it('keeps a demo group the visitor changed exactly as it is', () => {
    const [japan, flat, brighton] = demoGroups(new Date(2026, 0, 15), 1);
    const edited = { ...japan, expenses: japan.expenses.map((expense, i) => (i === 0 ? { ...expense, description: 'Our flat in Shinjuku' } : expense)) };
    const { groups } = migrate({ groups: [edited, flat, brighton] }, 1);
    expect(groups[0]).toBe(edited);
    expect(jrPass(groups)).toBe(false);
  });

  it('keeps the visitor’s own groups, and their order', () => {
    const [japan] = demoGroups(new Date(2026, 0, 15), 1);
    const own = { ...japan, id: 'g_mine', name: 'Lisbon' };
    const { groups } = migrate({ groups: [own, japan] }, 1);
    expect(groups.map((group) => group.id)).toEqual(['g_mine', 'demo_japan']);
    expect(groups[0]).toBe(own);
  });

  it('copes with nothing, or nonsense, saved', () => {
    expect(migrate(undefined, 1)).toEqual({ groups: [] });
    expect(migrate({ groups: 'yes' }, 1)).toEqual({ groups: [] });
  });

  it('leaves current data alone', () => {
    const saved = { groups: demoGroups(new Date(2026, 0, 15)) };
    expect(migrate(saved, 3).groups).toBe(saved.groups);
  });
});
