import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button, IconButton } from '@/components/button';
import { DateField } from '@/components/calendar';
import { Chip } from '@/components/chip';
import { Field } from '@/components/field';
import { Icon } from '@/components/icon';
import { Card, Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { useLastDefined } from '@/hooks/use-last-defined';
import { CATEGORIES, CategoryId } from '@/lib/categories';
import { daysAgo } from '@/lib/dates';
import { nameOf as memberName } from '@/lib/members';
import { CURRENCIES, formatMoney, parseAmount, toInputString } from '@/lib/money';
import { participantsOf, sharesOf, Split, SplitKind, splitProblem } from '@/lib/split';
import type { Expense, Group, Member } from '@/lib/types';
import { useGroup, useGroups } from '@/store/groups';
import { font, radius, space, useTheme } from '@/theme';

const SPLITS = [
  { value: 'equal', label: 'Equally' },
  { value: 'shares', label: 'By shares' },
  { value: 'exact', label: 'Exact' },
] as const;

/** Who the expense can involve: everyone who hasn't left, and anyone already on it. */
function peopleFor(group: Group, expense: Expense | undefined): Member[] {
  const involved = new Set(expense ? [expense.paidBy, ...participantsOf(expense.split)] : []);
  return group.members.filter((member) => !member.left || involved.has(member.id));
}

/** The form’s starting state: a blank expense, or the one being edited. */
function initialState(group: Group, expense: Expense | undefined, people: Member[]) {
  const everyone = people.map((member) => member.id);
  const split = expense?.split;
  return {
    date: expense?.date ?? daysAgo(0),
    note: expense?.note ?? '',
    amountText: expense ? toInputString(expense.amount, group.currency) : '',
    description: expense?.description ?? '',
    category: (expense?.category ?? 'food') as CategoryId,
    paidBy: expense?.paidBy ?? group.me,
    kind: (split?.kind ?? 'equal') as SplitKind,
    among: split?.kind === 'equal' ? split.among : everyone,
    shares: split?.kind === 'shares' ? split.shares : Object.fromEntries(everyone.map((id) => [id, 1])),
    exactTexts:
      split?.kind === 'exact'
        ? Object.fromEntries(everyone.map((id) => [id, split.amounts[id] ? toInputString(split.amounts[id], group.currency) : '']))
        : Object.fromEntries(everyone.map((id) => [id, ''])),
  };
}

function ExpenseForm({ group, expense }: { group: Group; expense?: Expense }) {
  const theme = useTheme();
  const addExpense = useGroups((state) => state.addExpense);
  const updateExpense = useGroups((state) => state.updateExpense);
  const removeExpense = useGroups((state) => state.removeExpense);
  const restoreExpense = useGroups((state) => state.restoreExpense);
  const showToast = useToast((state) => state.show);
  const people = useMemo(() => peopleFor(group, expense), [group, expense]);
  const start = useMemo(() => initialState(group, expense, people), [group, expense, people]);
  const [amountText, setAmountText] = useState(start.amountText);
  const [description, setDescription] = useState(start.description);
  const [category, setCategory] = useState<CategoryId>(start.category);
  const [paidBy, setPaidBy] = useState(start.paidBy);
  const [kind, setKind] = useState<SplitKind>(start.kind);
  const [among, setAmong] = useState<string[]>(start.among);
  const [shares, setShares] = useState<Record<string, number>>(start.shares);
  const [exactTexts, setExactTexts] = useState<Record<string, string>>(start.exactTexts);
  const [date, setDate] = useState(start.date);
  const [note, setNote] = useState(start.note);

  const { currency } = group;
  const amount = parseAmount(amountText, currency) ?? 0;
  const amountInvalid = amountText.trim() !== '' && parseAmount(amountText, currency) === null;
  const split: Split =
    kind === 'equal'
      ? { kind, among: people.map((member) => member.id).filter((id) => among.includes(id)) }
      : kind === 'shares'
        ? { kind, shares }
        : { kind, amounts: Object.fromEntries(Object.entries(exactTexts).map(([id, text]) => [id, parseAmount(text, currency) ?? 0])) };
  const problem = amountInvalid
    ? 'That isn’t a valid amount.'
    : description.trim() === ''
      ? 'Say what it was for.'
      : splitProblem(amount, split, currency);
  const preview = amount > 0 && (kind !== 'exact' || problem === null) ? sharesOf(amount, split) : {};
  const nameOf = (id: string) => memberName(group, id);

  const close = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/group/[id]', params: { id: group.id } }));
  const save = () => {
    if (problem) return;
    const data = { description: description.trim(), amount, paidBy, split, category, date, note: note.trim() || undefined };
    if (expense) updateExpense(group.id, expense.id, data);
    else addExpense(group.id, data);
    showToast(expense ? 'Expense updated' : `Added ${data.description}`);
    close();
  };

  return (
    <Screen footer={<Button label={expense ? 'Save changes' : 'Add expense'} icon="check" disabled={problem !== null} onPress={save} testID="save-expense" />}>
      <TopBar title={expense ? 'Edit expense' : 'Add expense'} leading={{ icon: 'x', label: 'Close', onPress: close }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Scroll>
          <View style={styles.amountRow}>
            <Text style={[styles.currency, { color: theme.inkMuted }]}>{CURRENCIES[currency].symbol}</Text>
            <Field
              testID="amount"
              accessibilityLabel={`Amount in ${CURRENCIES[currency].name}s`}
              value={amountText}
              onChangeText={setAmountText}
              placeholder={CURRENCIES[currency].decimals === 0 ? '0' : '0.00'}
              inputMode="decimal"
              keyboardType="decimal-pad"
              autoFocus={!expense}
              bare
              style={[
                styles.amountInput,
                // Sized to its digits, so the currency symbol stays beside the number.
                { color: amountInvalid ? theme.negative : theme.ink, width: Math.max(1, (amountText || '0').length) * 31 + 12 },
              ]}
            />
          </View>
          <Field testID="description" accessibilityLabel="What it was for" value={description} onChangeText={setDescription} placeholder="What was it for?" maxLength={60} returnKeyType="done" />
          <View style={styles.date}>
            <DateField value={date} onChange={setDate} />
          </View>

          <SectionLabel>Category</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Category">
            {CATEGORIES.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                selected={category === item.id}
                onPress={() => setCategory(item.id)}
                leading={<Icon name={item.icon} size={16} color={category === item.id ? theme.onBrand : theme.ink} />}
              />
            ))}
          </ScrollView>

          <SectionLabel>Paid by</SectionLabel>
          <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Paid by">
            {people.map((member) => (
              <Chip key={member.id} testID={`payer-${member.id}`} label={nameOf(member.id)} selected={paidBy === member.id} onPress={() => setPaidBy(member.id)} leading={<Avatar member={member} size={24} />} />
            ))}
          </View>

          <SectionLabel>Split</SectionLabel>
          <Segmented label="How to split it" options={SPLITS} value={kind} onChange={setKind} />
          <Card style={styles.people}>
            {people.map((member, index) => {
              const share = preview[member.id];
              const included = kind === 'equal' ? among.includes(member.id) : kind === 'shares' ? (shares[member.id] ?? 0) > 0 : (parseAmount(exactTexts[member.id] ?? '', currency) ?? 0) > 0;
              return (
                <View key={member.id} style={[styles.person, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }]}>
                  <Avatar member={member} size={32} />
                  <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                    {nameOf(member.id)}
                  </Text>
                  {kind !== 'exact' ? (
                    <Text variant="label" tone={included ? 'ink' : 'muted'} style={styles.share}>
                      {included && share !== undefined ? formatMoney(share, currency) : '—'}
                    </Text>
                  ) : null}
                  {kind === 'equal' ? (
                    <Pressable
                      testID={`include-${member.id}`}
                      accessibilityRole="checkbox"
                      aria-checked={included}
                      accessibilityLabel={`Split with ${nameOf(member.id)}`}
                      onPress={() => setAmong((current) => (current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id]))}
                      hitSlop={8}
                      style={[styles.check, { backgroundColor: included ? theme.brand : 'transparent', borderColor: included ? theme.brand : theme.line }]}
                    >
                      {included ? <Icon name="check" size={16} color={theme.onBrand} /> : null}
                    </Pressable>
                  ) : null}
                  {kind === 'shares' ? (
                    <View style={styles.stepper}>
                      <IconButton icon="minus" label={`One share fewer for ${nameOf(member.id)}`} onPress={() => setShares((s) => ({ ...s, [member.id]: Math.max(0, (s[member.id] ?? 0) - 1) }))} />
                      <Text variant="bodyStrong" style={styles.count} accessibilityLabel={`${shares[member.id] ?? 0} shares`}>
                        {shares[member.id] ?? 0}
                      </Text>
                      <IconButton icon="plus" label={`One share more for ${nameOf(member.id)}`} onPress={() => setShares((s) => ({ ...s, [member.id]: Math.min(99, (s[member.id] ?? 0) + 1) }))} />
                    </View>
                  ) : null}
                  {kind === 'exact' ? (
                    <Field
                      testID={`exact-${member.id}`}
                      accessibilityLabel={`${nameOf(member.id)}'s amount`}
                      value={exactTexts[member.id] ?? ''}
                      onChangeText={(text) => setExactTexts((current) => ({ ...current, [member.id]: text }))}
                      placeholder={CURRENCIES[currency].decimals === 0 ? '0' : '0.00'}
                      inputMode="decimal"
                      keyboardType="decimal-pad"
                      style={styles.exact}
                    />
                  ) : null}
                </View>
              );
            })}
          </Card>
          <SectionLabel>Note</SectionLabel>
          <Field
            testID="note"
            accessibilityLabel="Note"
            value={note}
            onChangeText={setNote}
            placeholder="Anything worth remembering"
            multiline
            maxLength={200}
            style={styles.note}
          />
          {problem && (amountText !== '' || description !== '') ? (
            <View style={styles.problem} accessibilityLiveRegion="polite">
              <Icon name="warningCircle" size={18} color={theme.negative} />
              <Text variant="label" tone="negative" testID="split-problem">
                {problem}
              </Text>
            </View>
          ) : null}

          {expense ? (
            <View style={{ marginTop: space(8) }}>
              <Button
                variant="danger"
                icon="trash"
                label="Delete expense"
                onPress={() => {
                  const removed = removeExpense(group.id, expense.id);
                  if (removed) showToast(`Deleted ${removed.description}`, { label: 'Undo', onPress: () => restoreExpense(group.id, removed) });
                  close();
                }}
              />
            </View>
          ) : null}
        </Scroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}

export default function ExpenseScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId?: string }>();
  const group = useLastDefined(useGroup(id));
  const expense = useLastDefined(group?.expenses.find((item) => item.id === expenseId));
  if (!group) {
    return (
      <Screen>
        <TopBar leading={{ icon: 'x', label: 'Close', onPress: () => router.replace('/') }} />
        <Text variant="heading" accessibilityRole="header" style={{ textAlign: 'center', marginTop: space(10) }}>
          This group isn’t here
        </Text>
      </Screen>
    );
  }
  return <ExpenseForm key={expense?.id ?? 'new'} group={group} expense={expense} />;
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(1), paddingVertical: space(4) },
  currency: { fontFamily: font.heavy, fontSize: 40, lineHeight: 48 },
  amountInput: {
    fontFamily: font.heavy,
    fontSize: 48,
    minHeight: 64,
    minWidth: 48,
    maxWidth: 320,
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  chips: { gap: space(2), paddingRight: space(5) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  people: { marginTop: space(3), paddingVertical: 0 },
  person: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 60 },
  share: { fontVariant: ['tabular-nums'], minWidth: 80, textAlign: 'right' },
  check: { width: 28, height: 28, borderRadius: radius.sm - 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  count: { minWidth: 24, textAlign: 'center', fontVariant: ['tabular-nums'] },
  exact: { width: 120, minHeight: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  problem: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(3) },
  date: { marginTop: space(3) },
  note: { minHeight: 88, textAlignVertical: 'top' },
});
