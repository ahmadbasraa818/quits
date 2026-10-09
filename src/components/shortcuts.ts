import { useIsFocused } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';
import { Platform } from 'react-native';

/** Whether a key press is someone typing in a field, or part of a browser or system shortcut. */
function notForUs(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return true;
  const target = event.target as HTMLElement | null;
  return Boolean(target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)));
}

/** Runs the handler for a key, if there is one, and stops the browser acting on it too. */
function handle(event: KeyboardEvent, keys: Record<string, () => void>) {
  if (notForUs(event)) return;
  const run = keys[event.key];
  if (!run) return;
  event.preventDefault();
  run();
}

/** Keyboard shortcuts for a screen, on the web, only while it's the screen in front. */
export function useShortcuts(keys: Record<string, () => void>) {
  const focused = useIsFocused();
  const onKey = useEffectEvent((event: KeyboardEvent) => handle(event, keys));
  useEffect(() => {
    if (!focused || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [focused]);
}

/** Keyboard shortcuts that work on every screen, on the web. */
export function useGlobalShortcuts(keys: Record<string, () => void>) {
  const onKey = useEffectEvent((event: KeyboardEvent) => handle(event, keys));
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}
