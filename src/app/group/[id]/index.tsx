import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { AvatarStack } from '@/components/avatar';
import { BalanceBars } from '@/components/balance-bars';
import { Button, IconButton } from '@/components/button';
import { ExpenseRow } from '@/components/expense-row';
import { Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { Money } from '@/components/money';
import { Segmented } from '@/components/segmented';
import { SettleUp } from '@/components/settle-up';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { useLastDefined } from '@/hooks/use-last-defined';
import { dayLabel } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Expense, Group } from '@/lib/types';
import { useGroup, useGroups } from '@/store/groups';
import { useSummary } from '@/store/summary';
import { radius, space, useTheme } from '@/theme';

type Tab = 'expenses' | 'balances' | 'settle';

const TABS = [
  { value: 'expenses', label: 'Expenses' },
  { value: 'balances', label: 'Balances' },
  { value: 'settle', label: 'Settle up' },
] as const;

function Expenses({ group }: { group: Group }) {
  const theme = useTheme();
  const removeExpense = useGroups((state) => state.removeExpense);
  const restoreExpense = useGroups((state) => state.restoreExpense);
  const showToast = useToast((state) => state.show);
  const sorted = [...group.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const days: { date: string; items: Expense[] }[] = [];
  for (const expense of sorted) {
    const last = days[days.length - 1];
    if (last && last.date === expense.date) last.items.push(expense);
    else days.push({ date: expense.date, items: [expense] });
  }

  if (sorted.length === 0) {
    return (
      <View style={styles.empty}>
        <Text variant="heading" accessibilityRole="header">
          No expenses yet
        </Text>
        <Text variant="body" tone="muted" style={{ textAlign: 'center' }}>
          Add what someone paid for, and Quits keeps the score.
        </Text>
      </View>
    );
  }
  return (
    <View>
      {days.map((day) => (
        <View key={day.date}>
          <SectionLabel>{dayLabel(day.date)}</SectionLabel>
          <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.line }]}>
            {day.items.map((expense, index) => (
              <Animated.View
                key={expense.id}
                entering={FadeIn}
                exiting={FadeOut}
                layout={LinearTransition}
                style={index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line } : undefined}
              >
                <ExpenseRow
                  expense={expense}
                  group={group}
                  onPress={() => router.push({ pathname: '/group/[id]/expense', params: { id: group.id, expenseId: expense.id } })}
                  onDelete={() => {
                    const removed = removeExpense(group.id, expense.id);
                    if (removed) showToast(`Deleted ${removed.description}`, { label: 'Undo', onPress: () => restoreExpense(group.id, removed) });
                  }}
                />
              </Animated.View>
            ))}
          </View>
        </View>
      ))}
      <Text variant="caption" tone="muted" style={styles.hint}>
        Swipe an expense left to delete it, or tap it to edit.
      </Text>
    </View>
  );
}

export default function GroupScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useLastDefined(useGroup(id));
  const summary = useSummary(group);
  const [tab, setTab] = useState<Tab>('expenses');
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!group || !summary) {
    return (
      <Screen>
        <TopBar leading={{ icon: 'arrowLeft', label: 'Back to groups', onPress: goBack }} />
        <View style={styles.empty}>
          <Text variant="heading" accessibilityRole="header">
            This group isn’t here
          </Text>
          <Button label="See all groups" variant="secondary" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }

  const mine = summary.mine;
  return (
    <Screen
      footer={
        tab === 'expenses' ? (
          <Button label="Add expense" icon="plus" testID="add-expense" onPress={() => router.push({ pathname: '/group/[id]/expense', params: { id: group.id } })} />
        ) : null
      }
    >
      <TopBar
        leading={{ icon: 'arrowLeft', label: 'Back to groups', onPress: goBack }}
        title={group.name}
        trailing={
          <IconButton icon="gearSix" label="Group settings" testID="group-settings" onPress={() => router.push({ pathname: '/group/[id]/settings', params: { id: group.id } })} />
        }
      />
      <Scroll>
        <View style={styles.header}>
          <AvatarStack members={group.members} size={32} max={6} />
          <Money amount={summary.total} currency={group.currency} variant="display" accessibilityLabel={`${formatMoney(summary.total, group.currency)} spent`} />
          <Text variant="body" tone="muted">
            spent by {group.members.length} people
          </Text>
          <View style={[styles.pill, { backgroundColor: mine > 0 ? theme.positive : mine < 0 ? theme.negative : theme.sunken }]}>
            <Text variant="label" style={{ color: mine === 0 ? theme.ink : theme.card, fontVariant: ['tabular-nums'] }}>
              {mine > 0 ? `You’re owed ${formatMoney(mine, group.currency)}` : mine < 0 ? `You owe ${formatMoney(-mine, group.currency)}` : "You’re square"}
            </Text>
          </View>
        </View>
        <Segmented label="Group sections" options={TABS} value={tab} onChange={setTab} />
        <View style={styles.tab}>
          {tab === 'expenses' ? <Expenses group={group} /> : null}
          {tab === 'balances' ? <BalanceBars group={group} balance={summary.balance} /> : null}
          {tab === 'settle' ? <SettleUp group={group} summary={summary} /> : null}
        </View>
      </Scroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: space(1.5), paddingTop: space(2), paddingBottom: space(5) },
  pill: { borderRadius: radius.pill, paddingVertical: space(1.5), paddingHorizontal: space(3.5), marginTop: space(2) },
  tab: { paddingTop: space(2) },
  panel: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  hint: { textAlign: 'center', marginTop: space(5) },
  empty: { alignItems: 'center', gap: space(3), paddingVertical: space(12), paddingHorizontal: space(6) },
});
