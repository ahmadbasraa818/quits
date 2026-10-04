import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Hands text to the system share sheet. On the web that's the Web Share API
 * where the browser has it, and the clipboard where it doesn't: desktop
 * browsers, and pages embedded in another site, which may not share.
 */
export async function shareText(text: string): Promise<ShareResult> {
  if (Platform.OS !== 'web') {
    try {
      const result = await Share.share({ message: text });
      return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
    } catch {
      return 'failed';
    }
  }
  const browser = typeof navigator === 'undefined' ? undefined : navigator;
  if (browser?.share && (!browser.canShare || browser.canShare({ text }))) {
    try {
      await browser.share({ text });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await Clipboard.setStringAsync(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
