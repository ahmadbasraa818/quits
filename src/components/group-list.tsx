import { router } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { CurrencyCode, formatMoney } from '@/lib/money';
import type { Group } from '@/lib/types';
import { summarise } from '@/store/summary';
import { radius, space, useTheme } from '@/theme';

import { AvatarStack } from './avatar';
import { Card } from './layout';
import { Icon } from './icon';
import { Money } from './money';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

/** From this width the groups sit in a sidebar beside whatever is open. */
export const SPLIT_WIDTH = 960;

/** Whether the window is wide enough for the groups list and a group side by side. */
export function useSplitView(): boolean {
  return useWindowDimensions().width >= SPLIT_WIDTH;
}

/**
 * Opens a group. Beside the sidebar, the group replaces whatever was open,
 * so the back stack doesn't pile up with every group visited.
 */
export function openGroup(id: string, split: boolean) {
  if (split && router.canDismiss()) router.dismissAll();
  router.push({ pathname: '/group/[id]', params: { id } });
}

export function GroupCard({ group, index, selected = false, split = false }: { group: Group; index: number; selected?: boolean; split?: boolean }) {
  const theme = useTheme();
  const { total, mine } = summarise(group);
  const status = mine > 0 ? `You’re owed ${formatMoney(mine, group.currency)}` : mine < 0 ? `You owe ${formatMoney(-mine, group.currency)}` : 'Settled up';
  return (
    <Animated.View entering={FadeInDown.delay(60 * index).duration(320)}>
      <PressableScale
        testID={`group-${group.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${group.name}. ${group.members.length} people. ${status}.`}
        accessibilityState={{ selected }}
        aria-current={selected ? 'page' : undefined}
        onPress={() => openGroup(group.id, split)}
      >
        <Card style={[styles.groupCard, selected && { borderColor: theme.brand, borderWidth: 2 }]}>
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
export function Overview({ groups }: { groups: Group[] }) {
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
              {amount > 0 ? 'You’re owed' : 'You owe'}
            </Text>
            <Money amount={Math.abs(amount)} currency={currency} variant="title" tone="onBrand" />
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overview: { borderRadius: radius.lg, padding: space(5), gap: space(2) },
  overviewLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space(3) },
  groupCard: { gap: space(1.5) },
  groupTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  status: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), marginTop: space(2) },
});
