import { ScrollView, StyleSheet, View } from 'react-native';

import { isEmbedded } from '@/lib/install';
import { compareVersions } from '@/lib/version';
import { useSettings } from '@/store/settings';
import { space, useTheme } from '@/theme';

import { Button } from './button';
import { Icon, IconName } from './icon';
import { Sheet } from './sheet';
import { Text } from './text';

export type Release = { version: string; title: string; items: { icon: IconName; text: string }[] };

/** What each release brought, newest first. The newest is always the app's own version. */
export const RELEASES: Release[] = [
  {
    version: '2.1.0',
    title: 'Help when you need it',
    items: [
      { icon: 'question', text: 'A help centre you can search, and a “?” beside the trickier parts of Quits that opens the answer.' },
      { icon: 'sparkle', text: 'A welcome for anyone new, and this note whenever Quits changes.' },
      { icon: 'keyboard', text: 'Keyboard shortcuts on a computer: N adds an expense, Q is quick add, / searches and ? opens help.' },
    ],
  },
  {
    version: '2.0.0',
    title: 'Safe by default',
    items: [
      { icon: 'shieldCheck', text: 'Saved data Quits can’t read is set aside, never written over.' },
      { icon: 'lockSimple', text: 'A privacy page that says exactly when anything leaves your device.' },
      { icon: 'bug', text: 'If something breaks, a way out, and a way to report it.' },
    ],
  },
];

/** The releases newer than the one the person last saw. */
export const releasesSince = (version: string | null) => (version === null ? [] : RELEASES.filter((release) => compareVersions(release.version, version) > 0));

export function WhatsNew({ releases, visible, onClose }: { releases: Release[]; visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="What’s new" testID="whats-new" footer={<Button label="Got it" icon="check" onPress={onClose} testID="whats-new-done" />}>
      <ScrollView contentContainerStyle={styles.body}>
        {releases.map((release) => (
          <View key={release.version} style={styles.release}>
            <View>
              <Text variant="heading">{release.title}</Text>
              <Text variant="caption" tone="muted">
                Quits {release.version}
              </Text>
            </View>
            {release.items.map((item) => (
              <View key={item.text} style={styles.item}>
                <Icon name={item.icon} size={22} color={theme.ink} />
                <Text variant="body" style={styles.itemText}>
                  {item.text}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

/** After an update, what's changed since the person last looked, shown once. Never inside another site's page. */
export function WhatsNewOnUpdate() {
  const seen = useSettings((state) => state.seenVersion);
  const markSeen = useSettings((state) => state.markSeen);
  const releases = releasesSince(seen);
  return <WhatsNew releases={releases} visible={releases.length > 0 && !isEmbedded()} onClose={() => markSeen(RELEASES[0].version)} />;
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space(5), paddingBottom: space(4), gap: space(6) },
  release: { gap: space(3) },
  item: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start' },
  itemText: { flex: 1 },
});
