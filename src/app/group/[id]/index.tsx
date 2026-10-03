import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Avatar, AvatarStack } from '@/components/avatar';
import { BalanceBars } from '@/components/balance-bars';
import { Button } from '@/components/button';
import { ExpenseRow } from '@/components/expense-row';
import { Icon } from '@/components/icon';
import { Card, Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { Money } from '@/components/money';
import { Segmented } from '@/components/segmented';
import { SettleGraph } from '@/components/settle-graph';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { directDebts } from '@/lib/balances';
import { daysAgo } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Expense, Group } from '@/lib/types';
import { useGroup, useGroups } from '@/store/groups';
import { GroupSummary, useSummary } from '@/store/summary';
import { radius, space, useTheme } from '@/theme';

type Tab = 'expenses' | 'balances' | 'settle';

const TABS = [
  { value: 'expenses', label: 'Expenses' },
  { value: 'balances', label: 'Balances' },
  { value: 'settle', label: 'Settle up' },
] as const;

function dayLabel(date: string): string {
  if (date === daysAgo(0)) return 'Today';
  if (date === daysAgo(1)) return 'Yesterday';
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(year, month - 1, day));
}

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

function SettleUp({ group, summary }: { group: Group; summary: GroupSummary }) {
  const theme = useTheme();
  const recordPayment = useGroups((state) => state.recordPayment);
  const removePayment = useGroups((state) => state.removePayment);
  const showToast = useToast((state) => state.show);
  const [view, setView] = useState<'plan' | 'direct'>('plan');
  const { transfers, method } = summary.settlement;
  const nameOf = (id: string) => (id === group.me ? 'You' : group.members.find((member) => member.id === id)?.name ?? 'Someone');
  const memberOf = (id: string) => group.members.find((member) => member.id === id) ?? { id, name: '?', tone: 0 };

  if (transfers.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="checkCircle" size={48} color={theme.positive} />
        <Text variant="heading" accessibilityRole="header">
          Everyone’s square
        </Text>
        <Text variant="body" tone="muted" style={{ textAlign: 'center' }}>
          Nothing to settle in {group.name}.
        </Text>
      </View>
    );
  }

  const count = transfers.length;
  return (
    <View style={{ gap: space(4) }}>
      <View style={{ gap: space(1) }}>
        <Text variant="title" testID="settle-headline">
          {count === 1 ? 'One payment settles everyone' : `${count} payments settle everyone`}
        </Text>
        {summary.directCount > count ? (
          <Text variant="body" tone="muted">
            Paying back pair by pair would take {summary.directCount}.
          </Text>
        ) : null}
      </View>

      <Card style={{ gap: space(3) }}>
        <Segmented
          label="Show the payments"
          value={view}
          onChange={setView}
          options={[
            { value: 'plan', label: `Quits plan (${count})` },
            { value: 'direct', label: `Pair by pair (${summary.directCount})` },
          ]}
        />
        <SettleGraph group={group} transfers={view === 'plan' ? transfers : directDebts(group.expenses, group.payments)} emphasis={view} />
      </Card>

      <View style={styles.rows}>
        {transfers.map((transfer) => (
          <Animated.View key={`${transfer.from}-${transfer.to}`} entering={FadeIn} exiting={FadeOut} layout={LinearTransition}>
            <Card style={styles.transfer}>
              <View style={styles.transferPeople} accessible accessibilityLabel={`${nameOf(transfer.from)} ${transfer.from === group.me ? 'pay' : 'pays'} ${nameOf(transfer.to)} ${formatMoney(transfer.amount, group.currency)}`}>
                <Avatar member={memberOf(transfer.from)} size={32} />
                <Icon name="arrowRight" size={16} color={theme.inkMuted} />
                <Avatar member={memberOf(transfer.to)} size={32} />
                <View style={{ flex: 1, marginLeft: space(1) }}>
                  <Text variant="label" numberOfLines={1}>
                    {nameOf(transfer.from)} {transfer.from === group.me ? 'pay' : 'pays'} {nameOf(transfer.to)}
                  </Text>
                  <Money amount={transfer.amount} currency={group.currency} variant="bodyStrong" />
                </View>
              </View>
              <Button
                compact
                variant="secondary"
                label="Mark paid"
                testID={`pay-${transfer.from}-${transfer.to}`}
                accessibilityHint={`Records that ${nameOf(transfer.from)} paid ${nameOf(transfer.to)}`}
                onPress={() => {
                  const id = recordPayment(group.id, { ...transfer, date: daysAgo(0) });
                  showToast(`Recorded ${formatMoney(transfer.amount, group.currency)} to ${nameOf(transfer.to)}`, { label: 'Undo', onPress: () => removePayment(group.id, id) });
                }}
              />
            </Card>
          </Animated.View>
        ))}
      </View>

      <View style={styles.note}>
        <Icon name="sparkle" size={18} color={theme.inkMuted} />
        <Text variant="caption" tone="muted" style={{ flex: 1 }}>
          {method === 'exact'
            ? 'Quits checks every way to split the group into circles that cancel out, so this is the fewest payments possible.'
            : 'A big group: Quits matches the largest debts first, so no one makes more than one payment more than they need to.'}
        </Text>
      </View>
    </View>
  );
}

export default function GroupScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
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
      <TopBar leading={{ icon: 'arrowLeft', label: 'Back to groups', onPress: goBack }} title={group.name} />
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
  rows: { gap: space(2) },
  panel: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  hint: { textAlign: 'center', marginTop: space(5) },
  empty: { alignItems: 'center', gap: space(3), paddingVertical: space(12), paddingHorizontal: space(6) },
  transfer: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  transferPeople: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  note: { flexDirection: 'row', gap: space(2), alignItems: 'flex-start', paddingTop: space(2) },
});
