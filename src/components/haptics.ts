import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSettings } from '@/store/settings';

/** On a phone, unless the person has turned it off. The phone's own settings can turn it off too. */
const wanted = () => Platform.OS !== 'web' && useSettings.getState().haptics;

/** A light tick, for a choice: a button, a chip, a day. */
export function tick() {
  if (wanted()) Haptics.selectionAsync().catch(() => {});
}

/** Something done that changes the score: a payment recorded, an expense saved. */
export function success() {
  if (wanted()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Something removed, which can still be undone. */
export function warning() {
  if (wanted()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
