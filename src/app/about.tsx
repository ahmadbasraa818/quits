import { router } from 'expo-router';
import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { appVersion, issueUrl, openLink } from '@/components/crash-screen';
import { Icon, IconName } from '@/components/icon';
import { Card, Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { isAppleMobile, useInstall } from '@/lib/install';
import { pickBackupFile, saveBackupFile } from '@/components/backup-file';
import { ConfirmDialog } from '@/components/confirm';
import { localDate } from '@/lib/dates';
import type { Group } from '@/lib/types';
import { fromBackup, toBackup } from '@/store/backup';
import { useGroups } from '@/store/groups';
import { space, useTheme } from '@/theme';

const SOURCE = 'https://github.com/ahmadbasraa818/quits';

const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'scales',
    title: 'Fair to the penny',
    body: 'Money is kept in whole pence, cents or yen. When a bill won’t divide evenly, the leftover pennies go to the largest remainders, so every split adds up exactly.',
  },
  {
    icon: 'arrowsLeftRight',
    title: 'The fewest payments',
    body: 'Quits looks for the most circles of people whose debts cancel out. A group that splits into k such circles settles in n − k payments, and no fewer. It checks every way for groups of up to 16, in a blink.',
  },
  {
    icon: 'globeHemisphereWest',
    title: 'Any of 33 currencies',
    body: 'Pay in one currency and settle in another. Quits converts at the European Central Bank’s rate for the day, looked up through frankfurter.dev, which is the only time it goes online. You can type your own rate instead. The rate is fixed when you save, and the sums are exact.',
  },
  {
    icon: 'lockSimple',
    title: 'Yours, on this device',
    body: 'Your groups stay on this device. Nothing is sent anywhere, except a currency pair and a date when Quits looks up a rate.',
  },
  {
    icon: 'checkCircle',
    title: 'Tested on thousands of groups',
    body: 'Property tests generate random groups and check every settlement against an independent search for the true minimum.',
  },
];

/** On the web: install Quits to open like an app, offline too, where the browser can. */
function InstallCard() {
  const theme = useTheme();
  const { offer, installed } = useInstall();
  const apple = isAppleMobile();
  if (Platform.OS !== 'web' || installed || (!offer && !apple)) return null;
  return (
    <Card style={styles.point} testID="install-card">
      <Icon name="downloadSimple" size={24} color={theme.ink} />
      <View style={{ flex: 1, gap: space(2) }}>
        <Text variant="bodyStrong">Install Quits</Text>
        <Text variant="body" tone="muted">
          It opens like an app, and works without a connection.
          {apple && !offer ? ' In Safari, tap Share, then Add to Home Screen.' : ''}
        </Text>
        {offer ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              compact
              label="Install"
              icon="downloadSimple"
              onPress={async () => {
                await offer.prompt();
                useInstall.setState({ offer: null });
              }}
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/** Save every group to a file, or put them back from one. */
function YourData() {
  const groups = useGroups((state) => state.groups);
  const replaceAll = useGroups((state) => state.replaceAll);
  const showToast = useToast((state) => state.show);
  const [restoring, setRestoring] = useState<{ groups: Group[]; savedAt: string } | null>(null);
  const count = (n: number) => `${n} group${n === 1 ? '' : 's'}`;

  const save = async () => {
    try {
      await saveBackupFile(`quits-backup-${localDate(new Date())}.json`, toBackup(groups));
      if (Platform.OS === 'web') showToast(`Saved ${count(groups.length)} to a file`);
    } catch {
      showToast('The backup couldn’t be saved');
    }
  };
  const pick = async () => {
    try {
      const text = await pickBackupFile();
      if (text === null) return;
      const restored = fromBackup(text);
      if (restored.ok) setRestoring(restored);
      else showToast(restored.reason);
    } catch {
      showToast('That file couldn’t be read');
    }
  };

  return (
    <>
      <Text variant="body" tone="muted">
        Keep a copy of every group in a file, to move to another device or put back later.
      </Text>
      <View style={styles.dataActions}>
        <Button label="Save a backup" icon="downloadSimple" variant="secondary" onPress={save} testID="save-backup" />
        <Button label="Restore a backup" icon="uploadSimple" variant="ghost" onPress={pick} testID="restore-backup" />
      </View>
      <ConfirmDialog
        visible={restoring !== null}
        title="Restore this backup?"
        message={
          restoring
            ? `It has ${count(restoring.groups.length)}${restoring.savedAt ? `, saved ${restoring.savedAt.slice(0, 10)}` : ''}. They replace the ${count(groups.length)} on this device.`
            : ''
        }
        confirmLabel="Replace my groups"
        icon="uploadSimple"
        onCancel={() => setRestoring(null)}
        onConfirm={() => {
          if (!restoring) return;
          replaceAll(restoring.groups);
          setRestoring(null);
          showToast(`Restored ${count(restoring.groups.length)}`);
        }}
      />
    </>
  );
}

export default function AboutScreen() {
  const theme = useTheme();
  const resetDemo = useGroups((state) => state.resetDemo);
  const showToast = useToast((state) => state.show);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openSource = () => {
    if (Platform.OS === 'web') window.open(SOURCE, '_blank', 'noopener');
    else WebBrowser.openBrowserAsync(SOURCE).catch(() => {});
  };

  return (
    <Screen>
      <TopBar title="About Quits" leading={{ icon: 'x', label: 'Close', onPress: close }} />
      <Scroll>
        <Text variant="title" accessibilityRole="header">
          Split costs, settle fast
        </Text>
        <Text variant="body" tone="muted" style={{ marginTop: space(2) }}>
          Add what everyone paid for on a trip, in a flat or on a night out. Quits keeps a running score and tells you the fewest payments that make everyone square.
        </Text>

        <SectionLabel>How it works</SectionLabel>
        <View style={{ gap: space(3) }}>
          {POINTS.map((point) => (
            <Card key={point.title} style={styles.point}>
              <Icon name={point.icon} size={24} color={theme.ink} />
              <View style={{ flex: 1, gap: space(1) }}>
                <Text variant="bodyStrong">{point.title}</Text>
                <Text variant="body" tone="muted">
                  {point.body}
                </Text>
              </View>
            </Card>
          ))}
        </View>

        <View style={{ marginTop: space(3) }}>
          <InstallCard />
        </View>

        <SectionLabel>Your data</SectionLabel>
        <YourData />

        <SectionLabel>Privacy and help</SectionLabel>
        <View style={styles.dataActions}>
          <Button label="How Quits handles your data" icon="shieldCheck" variant="secondary" testID="open-privacy" onPress={() => router.push('/privacy')} />
          <Button label="Report a problem" icon="bug" variant="ghost" testID="report-problem" onPress={() => openLink(issueUrl())} />
        </View>

        <SectionLabel>Made with</SectionLabel>
        <Text variant="body" tone="muted">
          React Native, Expo Router, TypeScript, Reanimated, Zustand and react-native-svg. The same code runs on iOS, Android and the web.
        </Text>
        <Text variant="caption" tone="muted" style={{ marginTop: space(2) }} testID="app-version">
          Quits {appVersion()}
        </Text>

        <View style={styles.actions}>
          <Button label="View the source on GitHub" icon="githubLogo" variant="secondary" onPress={openSource} />
          <Button
            label="Reset the demo data"
            icon="arrowCounterClockwise"
            variant="ghost"
            testID="reset-demo"
            onPress={() => {
              resetDemo();
              showToast('Demo data restored');
              // Back to the groups already underneath, rather than stacking a second copy of them.
              if (router.canDismiss()) router.dismissAll();
              else router.replace('/');
            }}
          />
        </View>
      </Scroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  point: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start' },
  actions: { gap: space(3), marginTop: space(8) },
  dataActions: { gap: space(2), marginTop: space(3) },
});
