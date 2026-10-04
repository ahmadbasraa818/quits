import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AvatarStack } from '@/components/avatar';
import { BalanceBars } from '@/components/balance-bars';
import { Button, IconButton } from '@/components/button';
import { ExpenseList } from '@/components/expense-list';
import { Screen, Scroll, TopBar } from '@/components/layout';
import { Money } from '@/components/money';
import { Segmented } from '@/components/segmented';
import { SettleUp } from '@/components/settle-up';
import { Text } from '@/components/text';
import { useLastDefined } from '@/hooks/use-last-defined';
import { formatMoney } from '@/lib/money';
import { useGroup } from '@/store/groups';
import { useSummary } from '@/store/summary';
import { radius, space, useTheme } from '@/theme';

type Tab = 'expenses' | 'balances' | 'settle';

const TABS = [
  { value: 'expenses', label: 'Expenses' },
  { value: 'balances', label: 'Balances' },
  { value: 'settle', label: 'Settle up' },
] as const;

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
          {tab === 'expenses' ? <ExpenseList group={group} /> : null}
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
  empty: { alignItems: 'center', gap: space(3), paddingVertical: space(12), paddingHorizontal: space(6) },
});
