import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

const memory = new Map<string, string>();

/**
 * AsyncStorage, falling back to memory when the platform refuses: some
 * browsers block storage for an app embedded in another site, and a demo
 * should still work there, just without remembering anything.
 */
export const safeStorage: StateStorage = {
  async getItem(name) {
    try {
      return (await AsyncStorage.getItem(name)) ?? memory.get(name) ?? null;
    } catch {
      return memory.get(name) ?? null;
    }
  },
  async setItem(name, value) {
    memory.set(name, value);
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      // Memory only.
    }
  },
  async removeItem(name) {
    memory.delete(name);
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // Memory only.
    }
  },
};
