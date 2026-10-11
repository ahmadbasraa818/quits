import { Appearance } from 'react-native';

import type { ThemeChoice } from '@/store/settings';

/** Tells the phone too, so what it draws itself, such as the bars, the keyboard and switches, matches. */
export function applyTheme(choice: ThemeChoice) {
  Appearance.setColorScheme(choice === 'system' ? 'unspecified' : choice);
}
