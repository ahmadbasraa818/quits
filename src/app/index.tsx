import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AvatarStack } from '@/components/avatar';
import { Button, IconButton } from '@/components/button';
import { Icon } from '@/components/icon';
import { Card, Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { Money } from '@/components/money';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { CurrencyCode, formatMoney } from '@/lib/money';
import type { Group } from '@/lib/types';
import { useGroups } from '@/store/groups';
import { summarise } from '@/store/summary';
import { radius, space, useTheme } from '@/theme';

function GroupCard({ group, index }: { group: Group; index: number }) {
  const theme = useTheme();
  const { total, mine } = summarise(group);
  const status = mine > 0 ? `You’re owed ${formatMoney(mine, group.currency)}` : mine < 0 ? `You owe ${formatMoney(-mine, group.currency)}` : 'Settled up';
  return (
    <Animated.View entering={FadeInDown.delay(60 * index).duration(320)}>
      <PressableScale
        testID={`group-${group.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${group.name}. ${group.members.length} people. ${status}.`}
        onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
      >
        <Card style={styles.groupCard}>
          <View style={styles.groupTop}>
            <AvatarStack members={group.members} />
            <Icon name="caretRight" size={18} color={theme.inkMuted} />
          </View>
          <Text variant="heading">{group.name}</Text>
          <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
            {group.members.length} people · {formatMoney(total, group.currency)} spent
          </Text>
          <View style={styles.status}>
            {mine === 0 ? <Icon name="checkCircle" size={18} color={theme.inkMuted} /> : null}
            <Text variant="label" tone={mine > 0 ? 'positive' : mine < 0 ? 'negative' : 'muted'} style={{ fontVariant: ['tabular-nums'] }}>
              {status}
            </Text>
          </View>
        </Card>
      </PressableScale>
    </Animated.View>
  );
}

/** What you are owed or owe across every group, one line per currency. */
function Overview({ groups }: { groups: Group[] }) {
  const theme = useTheme();
  const byCurrency = new Map<CurrencyCode, number>();
  for (const group of groups) byCurrency.set(group.currency, (byCurrency.get(group.currency) ?? 0) + summarise(group).mine);
  const lines = [...byCurrency].filter(([, amount]) => amount !== 0);
  return (
    <View style={[styles.overview, { backgroundColor: theme.brand }]}>
      <Text variant="label" tone="onBrand">
        Across your groups
      </Text>
      {lines.length === 0 ? (
        <Text variant="title" tone="onBrand">
          You’re all square
        </Text>
      ) : (
        lines.map(([currency, amount]) => (
          <View key={currency} style={styles.overviewLine}>
            <Text variant="body" tone="onBrand">
              {amount > 0 ? "You’re owed" : 'You owe'}
            </Text>
            <Money amount={Math.abs(amount)} currency={currency} variant="title" tone="onBrand" />
          </View>
        ))
      )}
    </View>
  );
}

export default function GroupsScreen() {
  const groups = useGroups((state) => state.groups);
  return (
    <Screen footer={<Button label="New group" icon="plus" onPress={() => router.push('/new-group')} testID="new-group" />}>
      <TopBar trailing={<IconButton icon="info" label="About Quits" onPress={() => router.push('/about')} />} />
      <Scroll>
        <Text variant="display" accessibilityRole="header">
          Quits
        </Text>
        <Text variant="body" tone="muted" style={styles.tagline}>
          Split costs with friends. Settle up in the fewest payments.
        </Text>
        <Overview groups={groups} />
        <SectionLabel>Groups</SectionLabel>
        <View style={styles.list}>
          {groups.length === 0 ? (
            <Text variant="body" tone="muted">
              No groups yet. Start one for a trip, a flat or a night out.
            </Text>
          ) : (
            groups.map((group, index) => <GroupCard key={group.id} group={group} index={index} />)
          )}
        </View>
      </Scroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagline: { marginTop: space(1), marginBottom: space(5) },
  overview: { borderRadius: radius.lg, padding: space(5), gap: space(2) },
  overviewLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space(3) },
  list: { gap: space(3) },
  groupCard: { gap: space(1.5) },
  groupTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  status: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), marginTop: space(2) },
});
