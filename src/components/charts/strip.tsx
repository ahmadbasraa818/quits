import { StyleSheet, View } from 'react-native';

import { totalOf } from '@/lib/balances';
import { categoryOf } from '@/lib/categories';
import { spendingByCategory } from '@/lib/insights';
import type { Group } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

import { Icon } from '../icon';
import { PressableScale } from '../pressable-scale';
import { Text } from '../text';

/** The colour a category gets in charts: one each for the six biggest, one shared by the rest. */
export const chartColour = (chart: string[], rank: number) => (rank < 6 ? chart[rank] : chart[7]);

/** Where a group's money went, as one bar of categories, opening the full breakdown. */
export function SpendingStrip({ group, onOpen }: { group: Group; onOpen: () => void }) {
  const theme = useTheme();
  const categories = spendingByCategory(group.expenses);
  const total = totalOf(group.expenses);
  const words = categories
    .slice(0, 3)
    .map((item) => `${categoryOf(item.category).label} ${Math.round((item.amount / total) * 100)}%`)
    .join(' · ');
  return (
    <PressableScale
      testID="spending-strip"
      accessibilityRole="button"
      accessibilityLabel={`Spending: ${words}`}
      accessibilityHint="Opens where the money went"
      onPress={onOpen}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <View style={styles.top}>
        <Text variant="label" style={{ flex: 1 }}>
          Where it went
        </Text>
        <Text variant="caption" tone="muted">
          See all
        </Text>
        <Icon name="caretRight" size={16} color={theme.inkMuted} />
      </View>
      <View style={[styles.bar, { backgroundColor: theme.sunken }]}>
        {categories.map((item, rank) => (
          <View key={item.category} style={{ flex: item.amount, backgroundColor: chartColour(theme.chart, rank) }} />
        ))}
      </View>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {words}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space(4), gap: space(2.5) },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  bar: { flexDirection: 'row', height: 10, borderRadius: radius.pill, overflow: 'hidden', gap: 2 },
});
