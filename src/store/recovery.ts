import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/** Saved data Quits couldn't read when it opened, set aside instead of written over: when, what it was, and the data itself. */
export type SetAside = { at: string; what: string; data: string };

const KEY = 'quits-set-aside';

type RecoveryState = {
  /** What was set aside, now or on an earlier start, until the person saves or deletes it. */
  setAside: SetAside[];
  /** Whether the device has refused a save since Quits opened, so changes only last in memory. */
  notSaving: boolean;
};

export const useRecovery = create<RecoveryState>(() => ({ setAside: [], notSaving: false }));

// One change at a time, so data set aside while the store loads can't race what earlier starts kept.
let queue: Promise<unknown> = Promise.resolve();

/** Applies a change, and says whether the result is safely stored on the device. */
function update(change: (items: SetAside[]) => SetAside[]): Promise<boolean> {
  const run = queue.then(async () => {
    let stored: unknown = [];
    try {
      stored = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
    } catch {
      // Unreadable or unavailable: work from what this start knows.
    }
    // What's stored, and what this start holds that may not have reached storage, once each.
    const known = [...(Array.isArray(stored) ? (stored as SetAside[]) : []), ...useRecovery.getState().setAside];
    const next = change(known.filter((item, index) => known.findIndex((other) => other.data === item.data) === index));
    useRecovery.setState({ setAside: next });
    try {
      if (next.length > 0) await AsyncStorage.setItem(KEY, JSON.stringify(next));
      else await AsyncStorage.removeItem(KEY);
      return true;
    } catch {
      // Kept in memory for this start; the person can still save it as a file.
      return false;
    }
  });
  queue = run;
  return run;
}

/**
 * Keeps data that couldn't be read under its own key, once, and says whether
 * it's safely stored: only then may the original be cleared away.
 */
export const setAside = (what: string, data: string) =>
  update((items) => (items.some((item) => item.data === data) ? items : [...items, { at: new Date().toISOString(), what, data }]));

/** Brings back what earlier starts set aside and the person hasn't dealt with yet. */
export const loadSetAside = () => update((items) => items);

/** Deletes what was set aside, once the person has had the chance to save it. */
export const forgetSetAside = () => update(() => []);

/** Notes that the device refused a save. */
export function noteNotSaving() {
  if (!useRecovery.getState().notSaving) useRecovery.setState({ notSaving: true });
}
