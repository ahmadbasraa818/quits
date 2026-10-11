import type { ThemeChoice } from '@/store/settings';
import { themes } from '@/theme';

/**
 * Colours the browser's own bar to match. index.html gives it a colour for
 * each of the device's themes; a chosen theme gives both the same one.
 */
export function applyTheme(choice: ThemeChoice) {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = choice === 'system' ? (meta.media.includes('dark') ? 'dark' : 'light') : choice;
    meta.content = themes[scheme].background;
  }
}
