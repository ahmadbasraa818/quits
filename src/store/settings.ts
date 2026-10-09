import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { safeStorage } from './storage';

/**
 * The version to show changes after for someone who used Quits before it
 * kept track: everyone who saved groups before 2.1.0 sees 2.0.0's changes too.
 */
export const FIRST_TRACKED = '1.0.0';

/** How many reminders are remembered: plenty for every payment still open. */
const MAX_REMINDED = 100;

type Saved = {
  /** Whether the welcome card has been put away. */
  welcomeDone: boolean;
  /** The version whose changes the person has seen; null until Quits first opens. */
  seenVersion: string | null;
  /** Whether Quits taps back when pressed, on a phone. */
  haptics: boolean;
  /** When each payment was last reminded about, by `remindedKey`. */
  reminded: Record<string, number>;
};

type SettingsState = Saved & {
  finishWelcome: () => void;
  markSeen: (version: string) => void;
  setHaptics: (on: boolean) => void;
  noteReminded: (key: string, at?: number) => void;
};

/** What a reminder about one payment is remembered by. */
export const remindedKey = (groupId: string, from: string, to: string) => `${groupId}/${from}/${to}`;

const isTimes = (value: unknown): value is Record<string, number> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every((time) => Number.isSafeInteger(time));

/** What was saved, each part only if it's the right kind of thing, so damaged settings fall back to the defaults. */
function mergeSaved(persisted: unknown, current: SettingsState): SettingsState {
  const saved = (typeof persisted === 'object' && persisted !== null ? persisted : {}) as Partial<Record<keyof Saved, unknown>>;
  return {
    ...current,
    welcomeDone: typeof saved.welcomeDone === 'boolean' ? saved.welcomeDone : current.welcomeDone,
    seenVersion: typeof saved.seenVersion === 'string' ? saved.seenVersion : current.seenVersion,
    haptics: typeof saved.haptics === 'boolean' ? saved.haptics : current.haptics,
    reminded: isTimes(saved.reminded) ? saved.reminded : current.reminded,
  };
}

/** What Quits remembers about the person, apart from their groups. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      welcomeDone: false,
      seenVersion: null,
      haptics: true,
      reminded: {},
      finishWelcome: () => set({ welcomeDone: true }),
      markSeen: (version) => set({ seenVersion: version }),
      setHaptics: (on) => set({ haptics: on }),
      // The newest are kept, so the list can't grow for ever.
      noteReminded: (key, at = Date.now()) =>
        set((state) => ({
          reminded: Object.fromEntries(
            Object.entries({ ...state.reminded, [key]: at })
              .sort((a, b) => b[1] - a[1])
              .slice(0, MAX_REMINDED)
          ),
        })),
    }),
    {
      name: 'quits-settings',
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ welcomeDone, seenVersion, haptics, reminded }): Saved => ({ welcomeDone, seenVersion, haptics, reminded }),
      merge: mergeSaved,
    }
  )
);

/** Whether the settings have loaded. */
export function useSettingsHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useSettings.persist.onFinishHydration(onChange),
    () => useSettings.persist.hasHydrated(),
    () => false
  );
}

/**
 * Records the first start: a new person gets the welcome and no list of
 * changes; someone who used Quits before this was kept gets what's new
 * since then, and no welcome.
 */
export function settleFirstRun(hadSavedGroups: boolean, version: string) {
  if (useSettings.getState().seenVersion !== null) return;
  useSettings.setState(hadSavedGroups ? { welcomeDone: true, seenVersion: FIRST_TRACKED } : { seenVersion: version });
}
