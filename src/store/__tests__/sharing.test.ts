import { demoGroups } from '../demo';
import { fromBackup, toBackup } from '../backup';
import { originOf, useGroups } from '../groups';
import { STORE_VERSION } from '../migrations';

const find = (id: string) => useGroups.getState().groups.find((group) => group.id === id)!;

describe('copies from a shared link', () => {
  beforeEach(() => useGroups.getState().resetDemo());

  it('adds a copy of its own, with you as the person you chose', () => {
    const [japan] = demoGroups(new Date(2026, 9, 4));
    const shared = { ...japan, members: japan.members.map((member) => (member.id === 'you' ? { ...member, name: 'Ahmad' } : member)) };
    const id = useGroups.getState().importGroup(shared, 'aiko');
    const copy = find(id);
    expect(copy.id).not.toBe(japan.id);
    expect(copy).toMatchObject({ me: 'aiko', origin: 'demo_japan', name: 'Japan trip' });
    expect(copy.members.find((member) => member.id === 'you')?.name).toBe('Ahmad');
    expect(useGroups.getState().groups[0].id).toBe(id);
    // A copy of a copy still traces back to the original.
    expect(originOf({ id: 'g_other', origin: originOf(copy) })).toBe('demo_japan');
  });

  it('brings a copy up to date, keeping who you are in it', () => {
    const [japan] = demoGroups(new Date(2026, 9, 4));
    const id = useGroups.getState().importGroup(japan, 'ben');
    const newer = { ...japan, expenses: japan.expenses.slice(0, 3) };
    useGroups.getState().replaceGroup(id, newer);
    expect(find(id)).toMatchObject({ id, me: 'ben', origin: 'demo_japan' });
    expect(find(id).expenses).toHaveLength(3);
  });

  it('readies a group to share: your name, and an origin of its own', () => {
    const prepared = useGroups.getState().prepareShare('demo_japan', '  Ahmad ');
    expect(find('demo_japan').members[0]).toMatchObject({ id: 'you', name: 'Ahmad' });
    // Every visitor's demo trip is "demo_japan"; once shared, this one is told apart.
    expect(prepared?.origin).toMatch(/^o_/);
    expect(originOf(prepared!)).not.toBe('demo_japan');
    // Sharing again keeps the same origin, so copies still recognise it.
    expect(useGroups.getState().prepareShare('demo_japan', 'Ahmad')?.origin).toBe(prepared?.origin);
  });
});

describe('backups', () => {
  const groups = demoGroups(new Date(2026, 9, 4));

  it('restores exactly what was saved', () => {
    const restored = fromBackup(toBackup(groups, new Date('2026-10-04T12:00:00Z')));
    expect(restored).toEqual({ ok: true, groups, savedAt: '2026-10-04T12:00:00.000Z' });
  });

  it('brings an older backup up to date', () => {
    const old = JSON.stringify({ app: 'quits', version: 1, savedAt: '2026-01-01', groups: demoGroups(new Date(2026, 0, 1), 1) });
    const restored = fromBackup(old);
    expect(restored.ok && restored.groups[0].expenses.some((expense) => expense.description === 'JR Passes, bought at home')).toBe(true);
  });

  it.each([
    ['not JSON at all', 'hello', 'That file isn’t a Quits backup.'],
    ['another app’s file', JSON.stringify({ app: 'other', version: 1, groups: [] }), 'That file isn’t a Quits backup.'],
    ['a newer version', JSON.stringify({ app: 'quits', version: STORE_VERSION + 1, groups: [] }), 'That backup is from a newer version of Quits. Reload the app and try again.'],
    ['a damaged group', JSON.stringify({ app: 'quits', version: STORE_VERSION, groups: [{ ...groups[0], me: 'nobody' }] }), 'Part of that backup is damaged, so nothing was restored.'],
    ['the same group twice', JSON.stringify({ app: 'quits', version: STORE_VERSION, groups: [groups[0], groups[0]] }), 'That backup has the same group twice, so nothing was restored.'],
  ])('turns away %s', (_, text, reason) => {
    expect(fromBackup(text)).toEqual({ ok: false, reason });
  });

  it('replaces everything when restored', () => {
    useGroups.getState().replaceAll([groups[1]]);
    expect(useGroups.getState().groups.map((group) => group.id)).toEqual(['demo_flat']);
    useGroups.getState().resetDemo();
  });
});
