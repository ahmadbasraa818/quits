import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInput, useWindowDimensions, View } from 'react-native';

import { AvatarStack } from '@/components/avatar';
import { BalanceBars } from '@/components/balance-bars';
import { Button, IconButton } from '@/components/button';
import { ExpenseList } from '@/components/expense-list';
import { useSplitView } from '@/components/group-list';
import { Screen, Scroll, TopBar } from '@/components/layout';
import { Money } from '@/components/money';
import { QuickAdd } from '@/components/quick-add';
import { Segmented } from '@/components/segmented';
import { SettleUp } from '@/components/settle-up';
import { ShareCopy } from '@/components/share-copy';
import { useShortcuts } from '@/components/shortcuts';
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
  // A link can open the group on a tab, or with quick add or sharing already open: help's "Show me" does.
  const { id, tab: linkedTab, open } = useLocalSearchParams<{ id: string; tab?: string; open?: string }>();
  const group = useLastDefined(useGroup(id));
  const summary = useSummary(group);
  const [tab, setTab] = useState<Tab>(() => (TABS.some((item) => item.value === linkedTab) ? (linkedTab as Tab) : 'expenses'));
  const [quick, setQuick] = useState(open === 'quick');
  const [sharing, setSharing] = useState(open === 'share');
  const split = useSplitView();
  // Two labelled buttons need about 400 points; below that, quick add is its wand alone.
  const roomy = useWindowDimensions().width >= 400;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const searchRef = useRef<TextInput>(null);
  // On a computer: N adds an expense, Q is quick add, / searches. Not while a sheet is open over the group.
  const free = Boolean(group) && !quick && !sharing;
  const addExpense = () => free && group && router.push({ pathname: '/group/[id]/expense', params: { id: group.id } });
  const openQuick = () => free && setQuick(true);
  useShortcuts({
    n: addExpense,
    N: addExpense,
    q: openQuick,
    Q: openQuick,
    '/': () => {
      if (!free) return;
      setTab('expenses');
      // The list may only now be showing, so focus once it has drawn.
      requestAnimationFrame(() => searchRef.current?.focus());
    },
  });

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
          <View style={styles.footer}>
            <View style={roomy ? styles.quick : null}>
              <Button label="Quick add" icon="magicWand" variant="secondary" iconOnly={!roomy} testID="quick-add-button" onPress={() => setQuick(true)} />
            </View>
            <View style={styles.add}>
              <Button label="Add expense" icon="plus" testID="add-expense" onPress={() => router.push({ pathname: '/group/[id]/expense', params: { id: group.id } })} />
            </View>
          </View>
        ) : null
      }
    >
      <TopBar
        // Beside the sidebar the groups are always in view, so there's nothing to go back to.
        leading={split ? undefined : { icon: 'arrowLeft', label: 'Back to groups', onPress: goBack }}
        title={group.name}
        trailing={
          <>
            <IconButton icon="shareNetwork" label="Share a copy" testID="share-group" onPress={() => setSharing(true)} />
            <IconButton icon="gearSix" label="Group settings" testID="group-settings" onPress={() => router.push({ pathname: '/group/[id]/settings', params: { id: group.id } })} />
          </>
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
          {tab === 'expenses' ? <ExpenseList group={group} searchRef={searchRef} /> : null}
          {tab === 'balances' ? <BalanceBars group={group} balance={summary.balance} /> : null}
          {tab === 'settle' ? <SettleUp group={group} summary={summary} /> : null}
        </View>
      </Scroll>
      <QuickAdd group={group} visible={quick} onClose={() => setQuick(false)} />
      {sharing ? <ShareCopy group={group} visible onClose={() => setSharing(false)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: space(2) },
  quick: { flex: 2 },
  add: { flex: 3 },
  header: { alignItems: 'center', gap: space(1.5), paddingTop: space(2), paddingBottom: space(5) },
  pill: { borderRadius: radius.pill, paddingVertical: space(1.5), paddingHorizontal: space(3.5), marginTop: space(2) },
  tab: { paddingTop: space(2) },
  empty: { alignItems: 'center', gap: space(3), paddingVertical: space(12), paddingHorizontal: space(6) },
});
