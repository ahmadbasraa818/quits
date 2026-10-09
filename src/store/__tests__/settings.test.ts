import AsyncStorage from '@react-native-async-storage/async-storage';

import { remindedKey, useSettings } from '../settings';

const defaults = { welcomeDone: false, seenVersion: null, haptics: true, reminded: {} };

beforeEach(async () => {
  await AsyncStorage.clear();
  useSettings.setState(defaults);
});

describe('the settings', () => {
  it('remember when each payment was last reminded about, keeping the newest hundred', () => {
    const { noteReminded } = useSettings.getState();
    for (let index = 0; index < 120; index += 1) noteReminded(remindedKey('g', `m${index}`, 'you'), 1_000 + index);
    const { reminded } = useSettings.getState();
    expect(Object.keys(reminded)).toHaveLength(100);
    expect(reminded[remindedKey('g', 'm119', 'you')]).toBe(1_119);
    expect(reminded[remindedKey('g', 'm0', 'you')]).toBeUndefined();
    noteReminded(remindedKey('g', 'm119', 'you'), 5_000);
    expect(useSettings.getState().reminded[remindedKey('g', 'm119', 'you')]).toBe(5_000);
  });

  it('load what was saved', async () => {
    await AsyncStorage.setItem('quits-settings', JSON.stringify({ state: { welcomeDone: true, seenVersion: '2.1.0', haptics: false, reminded: { 'g/a/b': 7 } }, version: 0 }));
    await useSettings.persist.rehydrate();
    expect(useSettings.getState()).toMatchObject({ welcomeDone: true, seenVersion: '2.1.0', haptics: false, reminded: { 'g/a/b': 7 } });
  });

  it('fall back to the defaults for anything damaged', async () => {
    await AsyncStorage.setItem('quits-settings', JSON.stringify({ state: { welcomeDone: 'yes', seenVersion: 2, haptics: null, reminded: { 'g/a/b': 'soon' } }, version: 0 }));
    await useSettings.persist.rehydrate();
    expect(useSettings.getState()).toMatchObject(defaults);
    await AsyncStorage.setItem('quits-settings', '{not json');
    await useSettings.persist.rehydrate();
    expect(useSettings.getState()).toMatchObject(defaults);
  });
});
