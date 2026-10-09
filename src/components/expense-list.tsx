import { router } from 'expo-router';
import { type RefObject, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, type TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { totalOf } from '@/lib/balances';
import { CATEGORIES, CategoryId } from '@/lib/categories';
import { dayLabel } from '@/lib/dates';
import { filterExpenses } from '@/lib/insights';
import { formatMoney } from '@/lib/money';
import type { Expense, Group } from '@/lib/types';
import { useGroups } from '@/store/groups';
import { radius, space, useTheme } from '@/theme';

import { Button } from './button';
import { SpendingStrip } from './charts/strip';
import { Chip } from './chip';
import { ExpenseRow } from './expense-row';
import { Field } from './field';
import { warning } from './haptics';
import { Icon } from './icon';
import { SectionLabel } from './layout';
import { Text } from './text';
import { useToast } from './toast';

/** How many expenses to show before offering more, so a long history stays quick. */
const PAGE = 50;

const plural = (count: number) => `${count} expense${count === 1 ? '' : 's'}`;

/** A group's expenses by day, newest first, with search, a category filter and the spending at a glance. */
export function ExpenseList({ group, searchRef }: { group: Group; searchRef?: RefObject<TextInput | null> }) {
  const theme = useTheme();
  const removeExpense = useGroups((state) => state.removeExpense);
  const restoreExpense = useGroups((state) => state.restoreExpense);
  const showToast = useToast((state) => state.show);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const sorted = useMemo(() => [...group.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), [group.expenses]);
  const found = useMemo(() => filterExpenses(sorted, { query, category }), [sorted, query, category]);
  const present = useMemo(() => CATEGORIES.filter((item) => group.expenses.some((expense) => expense.category === item.id)), [group.expenses]);
  const filtering = query.trim() !== '' || category !== null;
  const days: { date: string; items: Expense[] }[] = [];
  for (const expense of found.slice(0, limit)) {
    const last = days[days.length - 1];
    if (last && last.date === expense.date) last.items.push(expense);
    else days.push({ date: expense.date, items: [expense] });
  }
  const clear = () => {
    setQuery('');
    setCategory(null);
  };

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
      {sorted.length > 1 ? <SpendingStrip group={group} onOpen={() => router.push({ pathname: '/group/[id]/spending', params: { id: group.id } })} /> : null}
      {sorted.length >= 4 ? (
        <View style={styles.tools}>
          <Field
            ref={searchRef}
            testID="search-expenses"
            accessibilityLabel="Search expenses"
            placeholder="Search expenses"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
            leading={<Icon name="magnifyingGlass" size={18} color={theme.inkMuted} />}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Show a category">
            <Chip label="All" selected={category === null} onPress={() => setCategory(null)} testID="category-all" />
            {present.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                selected={category === item.id}
                onPress={() => setCategory(category === item.id ? null : item.id)}
                leading={<Icon name={item.icon} size={16} color={category === item.id ? theme.onBrand : theme.ink} />}
                testID={`filter-${item.id}`}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {filtering ? (
        <View style={styles.summary} accessibilityLiveRegion="polite">
          <Text variant="label" style={{ flex: 1 }} testID="filter-summary">
            {found.length === 0 ? 'Nothing matches' : `${plural(found.length)} · ${formatMoney(totalOf(found), group.currency)}`}
          </Text>
          <Button compact variant="ghost" label="Clear" onPress={clear} testID="clear-filter" />
        </View>
      ) : null}

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
                    if (removed) {
                      warning();
                      showToast(`Deleted ${removed.description}`, { label: 'Undo', onPress: () => restoreExpense(group.id, removed) });
                    }
                  }}
                />
              </Animated.View>
            ))}
          </View>
        </View>
      ))}

      {found.length > limit ? (
        <View style={styles.more}>
          <Button variant="secondary" label={`Show ${Math.min(PAGE, found.length - limit)} more`} onPress={() => setLimit((current) => current + PAGE)} testID="show-more" />
        </View>
      ) : null}
      {found.length > 0 ? (
        <Text variant="caption" tone="muted" style={styles.hint}>
          Swipe an expense left to delete it, or tap it to edit.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tools: { gap: space(3), marginTop: space(4) },
  chips: { gap: space(2), paddingRight: space(5) },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(4) },
  panel: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  more: { marginTop: space(4) },
  hint: { textAlign: 'center', marginTop: space(5) },
  empty: { alignItems: 'center', gap: space(3), paddingVertical: space(12), paddingHorizontal: space(6) },
});
