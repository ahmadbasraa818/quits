import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Bars, BarDatum } from '@/components/charts/bars';
import { Donut } from '@/components/charts/donut';
import { Icon } from '@/components/icon';
import { Card, Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { Money } from '@/components/money';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { totalOf } from '@/lib/balances';
import { categoryOf } from '@/lib/categories';
import { dayLabel, longDateLabel, monthLabel, parseLocalDate } from '@/lib/dates';
import { Bucket, spendingByCategory, spendingOverTime, TimeUnit, whoPaidWhoUsed } from '@/lib/insights';
import { nameOf } from '@/lib/members';
import { formatMoney } from '@/lib/money';
import type { Group } from '@/lib/types';
import { useGroup } from '@/store/groups';
import { radius, space, useTheme } from '@/theme';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** A bucket's short label under its bar, and its words for the caption and screen readers. */
function describeBucket(bucket: Bucket, unit: TimeUnit, currency: Group['currency']) {
  const date = parseLocalDate(bucket.start);
  const money = `${formatMoney(bucket.amount, currency)} on ${plural(bucket.count, 'expense')}`;
  if (unit === 'day') return { label: String(date.getDate()), when: dayLabel(bucket.start), detail: `${longDateLabel(bucket.start)}: ${money}` };
  if (unit === 'week') return { label: `${date.getDate()}/${date.getMonth() + 1}`, when: `the week of ${dayLabel(bucket.start)}`, detail: `Week of ${longDateLabel(bucket.start)}: ${money}` };
  const month = monthLabel(date.getFullYear(), date.getMonth());
  return { label: month.slice(0, 3), when: month, detail: `${month}: ${money}` };
}

function Spending({ group }: { group: Group }) {
  const theme = useTheme();
  const [picked, setPicked] = useState<string | null>(null);
  const categories = useMemo(() => spendingByCategory(group.expenses), [group.expenses]);
  const { unit, buckets } = useMemo(() => spendingOverTime(group.expenses), [group.expenses]);
  const people = useMemo(() => whoPaidWhoUsed(group).filter((person) => person.paid > 0 || person.share > 0), [group]);
  const total = totalOf(group.expenses);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/group/[id]', params: { id: group.id } }));

  if (group.expenses.length === 0) {
    return (
      <Screen>
        <TopBar leading={{ icon: 'arrowLeft', label: 'Back', onPress: goBack }} title="Spending" />
        <View style={styles.empty}>
          <Text variant="heading" accessibilityRole="header">
            Nothing spent yet
          </Text>
          <Text variant="body" tone="muted" style={{ textAlign: 'center' }}>
            Add an expense to {group.name} and this fills in.
          </Text>
        </View>
      </Screen>
    );
  }

  // Six categories get their own colour; the rest share one.
  const shown = categories.slice(0, 6);
  const rest = categories.slice(6);
  const segments = [
    ...shown.map((item, index) => ({ key: item.category, value: item.amount, color: theme.chart[index] })),
    ...(rest.length > 0 ? [{ key: 'rest', value: rest.reduce((sum, item) => sum + item.amount, 0), color: theme.chart[7] }] : []),
  ];
  const colourOf = (index: number) => (index < 6 ? theme.chart[index] : theme.chart[7]);
  const percent = (amount: number) => (amount > 0 && amount / total < 0.005 ? '<1%' : `${Math.round((amount / total) * 100)}%`);

  const described = buckets.map((bucket) => ({ bucket, ...describeBucket(bucket, unit, group.currency) }));
  const bars: BarDatum[] = described.map(({ bucket, label, detail }) => ({ key: bucket.start, value: bucket.amount, label, detail }));
  const busiest = described.reduce((best, item) => (item.bucket.amount > best.bucket.amount ? item : best), described[0]);
  const chosen = described.find((item) => item.bucket.start === picked);
  const perUnit = Math.round(total / buckets.length);
  const largestPerson = Math.max(1, ...people.flatMap((person) => [person.paid, person.share]));
  const biggest = [...group.expenses].sort((a, b) => b.amount - a.amount).slice(0, 3);

  return (
    <Screen>
      <TopBar leading={{ icon: 'arrowLeft', label: 'Back', onPress: goBack }} title="Spending" />
      <Scroll>
        <View style={styles.header}>
          <Money amount={total} currency={group.currency} variant="display" accessibilityLabel={`${formatMoney(total, group.currency)} spent`} />
          <Text variant="body" tone="muted" style={{ textAlign: 'center' }} testID="spending-summary">
            {plural(group.expenses.length, 'expense')} over {plural(buckets.length, unit)}, about {formatMoney(perUnit, group.currency)} a {unit}
          </Text>
        </View>

        <SectionLabel>By category</SectionLabel>
        <Card style={styles.card}>
          <View style={styles.donut}>
            <Donut segments={segments} background={theme.card}>
              <Text variant="title">{percent(categories[0].amount)}</Text>
              <Text variant="caption" tone="muted">
                {categoryOf(categories[0].category).label}
              </Text>
            </Donut>
          </View>
          <View>
            {categories.map((item, index) => {
              const category = categoryOf(item.category);
              return (
                <View
                  key={item.category}
                  style={[styles.legendRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }]}
                  accessible
                  accessibilityLabel={`${category.label}: ${formatMoney(item.amount, group.currency)}, ${percent(item.amount)}, ${plural(item.count, 'expense')}`}
                  testID={`category-${item.category}`}
                >
                  <View style={[styles.swatch, { backgroundColor: colourOf(index) }]} />
                  <Icon name={category.icon} size={18} color={theme.ink} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{category.label}</Text>
                    <Text variant="caption" tone="muted">
                      {plural(item.count, 'expense')}
                    </Text>
                  </View>
                  <View style={styles.legendAmount}>
                    <Money amount={item.amount} currency={group.currency} variant="label" />
                    <Text variant="caption" tone="muted">
                      {percent(item.amount)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        <SectionLabel>Over time</SectionLabel>
        <Card style={styles.card}>
          <Text variant="label" accessibilityLiveRegion="polite" testID="busiest">
            {chosen
              ? `${chosen.when[0].toUpperCase()}${chosen.when.slice(1)}: ${formatMoney(chosen.bucket.amount, group.currency)}`
              : `Busiest ${unit}: ${busiest.when}, ${formatMoney(busiest.bucket.amount, group.currency)}`}
          </Text>
          <Bars data={bars} selected={picked} onSelect={setPicked} />
        </Card>

        <SectionLabel>Who paid, who used</SectionLabel>
        <Card style={styles.card}>
          {people.map((person, index) => {
            const member = group.members.find((item) => item.id === person.id) ?? { name: '?', tone: 0 };
            const name = nameOf(group, person.id);
            return (
              <PressableScale
                key={person.id}
                testID={`person-${person.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${name} paid ${formatMoney(person.paid, group.currency)} and used ${formatMoney(person.share, group.currency)}`}
                accessibilityHint="Shows how their balance adds up"
                onPress={() => router.push({ pathname: '/group/[id]/member/[memberId]', params: { id: group.id, memberId: person.id } })}
                style={[styles.person, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }]}
              >
                <Avatar member={member} size={32} />
                <View style={{ flex: 1, gap: space(1.5) }}>
                  <Text variant="bodyStrong">{name}</Text>
                  {[
                    { word: 'Paid', amount: person.paid, color: theme.ink },
                    { word: 'Used', amount: person.share, color: theme.brand },
                  ].map((row) => (
                    <View key={row.word} style={styles.meter}>
                      <Text variant="caption" tone="muted" style={styles.meterWord}>
                        {row.word}
                      </Text>
                      <View style={[styles.track, { backgroundColor: theme.sunken }]}>
                        <View style={[styles.fill, { backgroundColor: row.color, width: `${(row.amount / largestPerson) * 100}%` }]} />
                      </View>
                      <Money amount={row.amount} currency={group.currency} variant="caption" style={styles.meterAmount} />
                    </View>
                  ))}
                </View>
                <Icon name="caretRight" size={18} color={theme.inkMuted} />
              </PressableScale>
            );
          })}
        </Card>

        <SectionLabel>Biggest</SectionLabel>
        <Card style={{ paddingVertical: 0 }}>
          {biggest.map((expense, index) => (
            <PressableScale
              key={expense.id}
              accessibilityRole="button"
              accessibilityLabel={`${expense.description}, ${formatMoney(expense.amount, group.currency)}, ${dayLabel(expense.date)}`}
              onPress={() => router.push({ pathname: '/group/[id]/expense', params: { id: group.id, expenseId: expense.id } })}
              style={[styles.biggest, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }]}
            >
              <View style={[styles.tile, { backgroundColor: theme.sunken }]}>
                <Icon name={categoryOf(expense.category).icon} size={18} color={theme.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {expense.description}
                </Text>
                <Text variant="caption" tone="muted">
                  {dayLabel(expense.date)}
                </Text>
              </View>
              <Money amount={expense.amount} currency={group.currency} variant="bodyStrong" />
            </PressableScale>
          ))}
        </Card>
      </Scroll>
    </Screen>
  );
}

export default function SpendingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
  if (!group) {
    return (
      <Screen>
        <TopBar leading={{ icon: 'arrowLeft', label: 'Back', onPress: () => router.replace('/') }} />
        <Text variant="heading" accessibilityRole="header" style={{ textAlign: 'center', marginTop: space(10) }}>
          This group isn’t here
        </Text>
      </Screen>
    );
  }
  return <Spending group={group} />;
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: space(1.5), paddingTop: space(2), paddingBottom: space(2) },
  card: { gap: space(3) },
  donut: { alignItems: 'center', paddingVertical: space(2) },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2.5) },
  swatch: { width: 10, height: 10, borderRadius: radius.pill },
  legendAmount: { alignItems: 'flex-end' },
  person: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  meter: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  meterWord: { width: 34 },
  track: { flex: 1, height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  meterAmount: { minWidth: 72, textAlign: 'right' },
  biggest: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  tile: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: space(3), paddingVertical: space(12), paddingHorizontal: space(6) },
});
