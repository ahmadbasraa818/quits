import { useLinkingURL } from 'expo-linking';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Avatar, AvatarStack } from '@/components/avatar';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { useSplitView } from '@/components/group-list';
import { Card, Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { totalOf } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import { decodeGroup } from '@/lib/share-link';
import type { Group } from '@/lib/types';
import { originOf, useGroups } from '@/store/groups';
import { space, useTheme } from '@/theme';

/** What the link carries, after the #. */
function useFragment(): string {
  const url = useLinkingURL();
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.hash.slice(1);
  return url?.split('#')[1] ?? '';
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function Import({ shared }: { shared: Group }) {
  const theme = useTheme();
  const groups = useGroups((state) => state.groups);
  const importGroup = useGroups((state) => state.importGroup);
  const replaceGroup = useGroups((state) => state.replaceGroup);
  const showToast = useToast((state) => state.show);
  const split = useSplitView();
  // The same group, here already: an earlier copy of it, or the original.
  const existing = groups.find((group) => originOf(group) === originOf(shared));
  const sharer = shared.members.find((member) => member.id === shared.me);
  const choices = shared.members.filter((member) => member.id !== shared.me);
  const [me, setMe] = useState<string | null>(null);

  const open = (id: string) => {
    if (split && router.canDismiss()) router.dismissAll();
    router.replace({ pathname: '/group/[id]', params: { id } });
  };

  return (
    <Screen
      footer={
        existing ? (
          <View style={styles.actions}>
            <Button
              label="Update my copy"
              icon="arrowsClockwise"
              testID="update-copy"
              onPress={() => {
                replaceGroup(existing.id, shared);
                showToast(`Updated ${shared.name}`);
                open(existing.id);
              }}
            />
            <Button label="Keep mine as it is" variant="ghost" onPress={() => open(existing.id)} />
          </View>
        ) : (
          <Button
            label="Add to my groups"
            icon="plus"
            disabled={me === null}
            testID="add-copy"
            onPress={() => {
              if (!me) return;
              const id = importGroup(shared, me);
              showToast(`Added ${shared.name}`);
              open(id);
            }}
          />
        )
      }
    >
      <TopBar title="A shared group" leading={{ icon: 'x', label: 'Close', onPress: () => router.replace('/') }} />
      <Scroll>
        <Card style={styles.summary} testID="shared-summary">
          <AvatarStack members={shared.members} size={32} max={6} />
          <Text variant="title" accessibilityRole="header">
            {shared.name}
          </Text>
          <Text variant="body" tone="muted">
            {shared.members.length} {shared.members.length === 1 ? 'person' : 'people'} · {plural(shared.expenses.length, 'expense')} · {formatMoney(totalOf(shared.expenses), shared.currency)} spent
          </Text>
          {sharer ? (
            <View style={styles.sharer}>
              <Avatar member={sharer} size={24} />
              <Text variant="label">Shared by {sharer.name}</Text>
            </View>
          ) : null}
        </Card>

        {existing ? (
          <Text variant="body" style={styles.note} testID="already-here">
            You already have {existing.name}. This link may be newer: update your copy to match it, or keep yours as it is.
          </Text>
        ) : (
          <>
            <SectionLabel>Which one is you?</SectionLabel>
            <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel="Which one is you?">
              {choices.map((member) => (
                <Chip
                  key={member.id}
                  label={member.name}
                  selected={me === member.id}
                  onPress={() => setMe(member.id)}
                  leading={<Avatar member={member} size={24} />}
                  testID={`me-${member.id}`}
                />
              ))}
            </View>
            <Text variant="caption" tone="muted" style={styles.note}>
              Your copy is yours: what you add stays on this device. To keep in step, share updates back and forth.
            </Text>
          </>
        )}
        <View style={[styles.privacy, { borderTopColor: theme.line }]}>
          <Text variant="caption" tone="muted">
            The group came inside the link itself. Nothing was downloaded from a server.
          </Text>
        </View>
      </Scroll>
    </Screen>
  );
}

export default function ImportScreen() {
  const fragment = useFragment();
  const shared = useMemo(() => (fragment ? decodeGroup(fragment) : null), [fragment]);
  if (!shared) {
    return (
      <Screen>
        <TopBar leading={{ icon: 'x', label: 'Close', onPress: () => router.replace('/') }} />
        <View style={styles.empty}>
          <Text variant="heading" accessibilityRole="header">
            This link doesn’t hold a group
          </Text>
          <Text variant="body" tone="muted" style={{ textAlign: 'center' }}>
            It may have been cut short when it was sent. Ask for it again, or send it by email.
          </Text>
          <Button label="See your groups" variant="secondary" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }
  return <Import shared={shared} />;
}

const styles = StyleSheet.create({
  summary: { gap: space(2), alignItems: 'flex-start', marginTop: space(2) },
  sharer: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(1) },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  note: { marginTop: space(4) },
  privacy: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space(8), paddingTop: space(3) },
  actions: { gap: space(2) },
  empty: { alignItems: 'center', gap: space(3), paddingVertical: space(12), paddingHorizontal: space(6) },
});
