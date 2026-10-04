import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform, Pressable, Text as NativeText, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { localDate } from '@/lib/dates';
import { toBackup } from '@/store/backup';
import { useGroups } from '@/store/groups';
import { radius, space, useTheme } from '@/theme';

import { saveBackupFile } from './backup-file';

export const ISSUES = 'https://github.com/ahmadbasraa818/quits/issues/new';

/** The app's version, as its config gives it. */
export const appVersion = () => Constants.expoConfig?.version ?? 'unknown';

/**
 * A new GitHub issue, filled in with the version, the platform and what went
 * wrong. Only the error's message goes in: never a group, a name or an
 * amount.
 */
export function issueUrl(error?: Error): string {
  const lines = ['**What were you doing when it happened?**', '', '', `Quits ${appVersion()} on ${Platform.OS}${Platform.OS === 'web' && typeof navigator !== 'undefined' ? ` (${navigator.userAgent})` : ''}`];
  if (error) lines.push('', '**The error**', '', '```', String(error.message).slice(0, 300), '```');
  const title = error ? 'Quits stopped with an error' : 'A problem with Quits';
  return `${ISSUES}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

export function openLink(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
  else WebBrowser.openBrowserAsync(url).catch(() => {});
}

/**
 * What shows if a screen throws. It's built from React Native's own parts,
 * not the app's components, so whatever broke can't break it too. The
 * groups are in the store, not the screen, so they can still be saved.
 */
export function CrashScreen({ error, retry }: { error: Error; retry: () => void }) {
  const theme = useTheme();
  const [saved, setSaved] = useState<'idle' | 'saved' | 'failed'>('idle');
  const [details, setDetails] = useState(false);

  const save = () => {
    saveBackupFile(`quits-backup-${localDate(new Date())}.json`, toBackup(useGroups.getState().groups)).then(
      () => setSaved('saved'),
      () => setSaved('failed')
    );
  };
  const home = () => {
    router.replace('/');
    retry();
  };

  const action = (label: string, onPress: () => void, primary = false, testID?: string) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.button, { backgroundColor: primary ? theme.brand : theme.sunken, opacity: pressed ? 0.85 : 1 }]}
    >
      <NativeText style={[styles.buttonText, { color: primary ? theme.onBrand : theme.ink }]}>{label}</NativeText>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} testID="crash-screen">
      <ScrollView contentContainerStyle={styles.body}>
        <NativeText accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>
          Something went wrong
        </NativeText>
        <NativeText style={[styles.text, { color: theme.inkMuted }]}>
          Quits hit a problem it didn’t expect. Your groups are safe on this device: trying again usually works, and you can save a backup first if you like.
        </NativeText>
        <View style={styles.actions}>
          {action('Try again', retry, true, 'crash-retry')}
          {action('Go to your groups', home, false, 'crash-home')}
          {action(saved === 'saved' ? 'Backup saved' : saved === 'failed' ? 'Couldn’t save, try again' : 'Save a backup', save, false, 'crash-backup')}
          {action('Report the problem', () => openLink(issueUrl(error)), false, 'crash-report')}
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: details }} onPress={() => setDetails(!details)} style={styles.toggle}>
          <NativeText style={[styles.small, { color: theme.inkMuted, textDecorationLine: 'underline' }]}>{details ? 'Hide the details' : 'Show the details'}</NativeText>
        </Pressable>
        {details ? (
          <NativeText selectable style={[styles.details, { color: theme.ink, backgroundColor: theme.sunken }]} testID="crash-details">
            {String(error?.message ?? error)}
          </NativeText>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flexGrow: 1, justifyContent: 'center', padding: space(6), gap: space(4), maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  text: { fontSize: 17, lineHeight: 24 },
  actions: { gap: space(2), marginTop: space(2) },
  button: { minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(4) },
  buttonText: { fontSize: 16, fontWeight: '700' },
  toggle: { alignSelf: 'flex-start', paddingVertical: space(2) },
  small: { fontSize: 14 },
  details: { fontSize: 13, padding: space(3), borderRadius: radius.sm, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
});
