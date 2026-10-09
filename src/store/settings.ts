import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { safeStorage } from './storage';

/**
 * The version to show changes after for someone who used Quits before it
 * kept track: everyone who saved groups before 2.1.0 sees 2.0.0's changes too.
 */
export const FIRST_TRACKED = '1.0.0';

type SettingsState = {
  /** Whether the welcome card has been put away. */
  welcomeDone: boolean;
  /** The version whose changes the person has seen; null until Quits first opens. */
  seenVersion: string | null;
  finishWelcome: () => void;
  markSeen: (version: string) => void;
};

/** What Quits remembers about the person, apart from their groups. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      welcomeDone: false,
      seenVersion: null,
      finishWelcome: () => set({ welcomeDone: true }),
      markSeen: (version) => set({ seenVersion: version }),
    }),
    {
      name: 'quits-settings',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ welcomeDone: state.welcomeDone, seenVersion: state.seenVersion }),
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
