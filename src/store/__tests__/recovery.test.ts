import AsyncStorage from '@react-native-async-storage/async-storage';

import { validateGroup } from '@/lib/validate';

import { demoGroups } from '../demo';
import { useGroups } from '../groups';
import { STORE_VERSION } from '../migrations';
import { forgetSetAside, loadSetAside, useRecovery } from '../recovery';
import { safeStorage } from '../storage';

const [japan, flat] = demoGroups(new Date(2026, 9, 4));
const saved = (groups: unknown[]) => JSON.stringify({ state: { groups }, version: STORE_VERSION });
// Lets the queued set-aside writes and the save that follows them finish.
const settle = async () => {
  await loadSetAside();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(async () => {
  await AsyncStorage.clear();
  useRecovery.setState({ setAside: [], notSaving: false });
  useGroups.getState().replaceAll(demoGroups());
});

describe('saved data Quits can’t read', () => {
  it('is set aside, not written over, and the app opens as if new', async () => {
    await AsyncStorage.setItem('quits', '{not json');
    await useGroups.persist.rehydrate();
    await settle();
    expect(useRecovery.getState().setAside).toEqual([expect.objectContaining({ data: '{not json' })]);
    expect(JSON.parse((await AsyncStorage.getItem('quits-set-aside'))!)[0].data).toBe('{not json');
    // The original is cleared only once the copy is safe, so it isn't set aside again on every start.
    expect(await AsyncStorage.getItem('quits')).toBeNull();
    expect(useGroups.getState().groups.map((group) => group.id)).toContain('demo_japan');
  });

  it('opens every sound group, and sets aside one that isn’t', async () => {
    await AsyncStorage.setItem('quits', saved([japan, { ...flat, expenses: 'not a list' }]));
    await useGroups.persist.rehydrate();
    await settle();
    expect(useGroups.getState().groups.map((group) => group.id)).toEqual(['demo_japan']);
    expect(useRecovery.getState().setAside).toEqual([expect.objectContaining({ what: 'the group “Flat 4B”' })]);
    // The damaged group is gone from what's saved, now that it's kept aside.
    expect(JSON.parse((await AsyncStorage.getItem('quits'))!).state.groups.map((group: { id: string }) => group.id)).toEqual(['demo_japan']);
  });

  it('keeps each piece once, however often it starts', async () => {
    await AsyncStorage.setItem('quits-set-aside', JSON.stringify([{ at: 'earlier', what: 'w', data: 'd' }]));
    await loadSetAside();
    await loadSetAside();
    expect(useRecovery.getState().setAside).toHaveLength(1);
  });

  it('deletes what was set aside when asked', async () => {
    await AsyncStorage.setItem('quits-set-aside', JSON.stringify([{ at: 'earlier', what: 'w', data: 'd' }]));
    await loadSetAside();
    await forgetSetAside();
    expect(useRecovery.getState().setAside).toEqual([]);
    expect(await AsyncStorage.getItem('quits-set-aside')).toBeNull();
  });

  it('leaves an emptied list empty, rather than bringing back the demo', async () => {
    await AsyncStorage.setItem('quits', saved([]));
    await useGroups.persist.rehydrate();
    expect(useGroups.getState().groups).toEqual([]);
  });
});

describe('a device that won’t save', () => {
  it('is noticed, and changes still last for this visit', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('QuotaExceededError'));
    await safeStorage.setItem('quits-test', 'kept');
    expect(useRecovery.getState().notSaving).toBe(true);
    expect(await safeStorage.getItem('quits-test')).toBe('kept');
  });
});

describe('how strictly a group is checked', () => {
  // Years of a busy flat: more expenses than a shared link may carry, but sound.
  const busy = { ...japan, expenses: Array.from({ length: 6000 }, (_, index) => ({ ...japan.expenses[0], id: `e${index}` })) };

  it('holds data from other people to every limit', () => {
    expect(validateGroup(busy)).toBeNull();
  });

  it('only needs the person’s own data to be sound', () => {
    expect(validateGroup(busy, 'own')).not.toBeNull();
    expect(validateGroup({ ...busy, me: 'nobody' }, 'own')).toBeNull();
  });
});
