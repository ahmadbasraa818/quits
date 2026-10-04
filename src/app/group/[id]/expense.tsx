import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button, IconButton } from '@/components/button';
import { DateField } from '@/components/calendar';
import { Chip } from '@/components/chip';
import { Conversion, PinnedRate } from '@/components/conversion';
import { CurrencyPicker } from '@/components/currency-picker';
import { Field } from '@/components/field';
import { Icon } from '@/components/icon';
import { ItemDraft, ItemsEditor } from '@/components/items-editor';
import { Card, Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { useLastDefined } from '@/hooks/use-last-defined';
import { isSum, readAmount } from '@/lib/calc';
import { CATEGORIES, CategoryId } from '@/lib/categories';
import { daysAgo } from '@/lib/dates';
import { likelyCurrency, peopleFor } from '@/lib/expenses';
import { convert } from '@/lib/fx';
import { nameOf as memberName } from '@/lib/members';
import { createId } from '@/lib/ids';
import { CURRENCIES, CurrencyCode, formatMoney, MAX_AMOUNT, toInputString } from '@/lib/money';
import { itemsTotal, sharesOf, Split, SplitKind, splitProblem } from '@/lib/split';
import type { QuickDraft } from '@/lib/quick-add';
import type { Expense, Group, Member } from '@/lib/types';
import { useDraft } from '@/store/draft';
import { useGroup, useGroups } from '@/store/groups';
import { useEcbRate } from '@/store/rates';
import { font, radius, space, useTheme } from '@/theme';

const SPLITS = [
  { value: 'equal', label: 'Equally' },
  { value: 'shares', label: 'Shares' },
  { value: 'exact', label: 'Exact' },
  { value: 'items', label: 'Items' },
] as const;

/** Buttons for sums in the amount, since a phone's number pad has none. */
const OPERATORS = [
  { shown: '+', typed: '+', name: 'plus' },
  { shown: '−', typed: '-', name: 'minus' },
  { shown: '×', typed: '×', name: 'times' },
  { shown: '÷', typed: '÷', name: 'divided by' },
] as const;

/** The form’s starting state: the one being edited, a quick-add draft carried over, or a blank expense. */
function initialState(group: Group, expense: Expense | undefined, people: Member[], draft: QuickDraft | null) {
  const everyone = people.map((member) => member.id);
  if (!expense && draft) {
    return {
      currency: draft.currency,
      pinned: null,
      date: draft.date,
      note: '',
      amountText: draft.amount ? toInputString(draft.amount, draft.currency) : '',
      description: draft.description,
      category: draft.category,
      paidBy: draft.paidBy,
      kind: 'equal' as SplitKind,
      among: draft.among,
      shares: Object.fromEntries(everyone.map((id) => [id, 1])),
      exactTexts: Object.fromEntries(everyone.map((id) => [id, ''])),
      items: [] as ItemDraft[],
      extrasText: '',
    };
  }
  const split = expense?.split;
  const currency = expense ? (expense.original?.currency ?? group.currency) : likelyCurrency(group);
  return {
    currency,
    pinned: expense?.original ? ({ rate: expense.original.rate, source: 'saved' } satisfies PinnedRate) : null,
    date: expense?.date ?? daysAgo(0),
    note: expense?.note ?? '',
    amountText: expense ? toInputString(expense.original?.amount ?? expense.amount, currency) : '',
    description: expense?.description ?? '',
    category: (expense?.category ?? 'food') as CategoryId,
    paidBy: expense?.paidBy ?? group.me,
    kind: (split?.kind ?? 'equal') as SplitKind,
    among: split?.kind === 'equal' ? split.among : everyone,
    shares: split?.kind === 'shares' ? split.shares : Object.fromEntries(everyone.map((id) => [id, 1])),
    exactTexts:
      split?.kind === 'exact'
        ? Object.fromEntries(everyone.map((id) => [id, split.amounts[id] ? toInputString(split.amounts[id], currency) : '']))
        : Object.fromEntries(everyone.map((id) => [id, ''])),
    items:
      split?.kind === 'items'
        ? split.items.map((item): ItemDraft => ({ key: item.id, label: item.label, amountText: toInputString(item.amount, currency), among: item.among }))
        : ([] as ItemDraft[]),
    extrasText: split?.kind === 'items' && split.extras > 0 ? toInputString(split.extras, currency) : '',
  };
}

function ExpenseForm({ group, expense, draft = null }: { group: Group; expense?: Expense; draft?: QuickDraft | null }) {
  const theme = useTheme();
  const addExpense = useGroups((state) => state.addExpense);
  const updateExpense = useGroups((state) => state.updateExpense);
  const removeExpense = useGroups((state) => state.removeExpense);
  const restoreExpense = useGroups((state) => state.restoreExpense);
  const showToast = useToast((state) => state.show);
  const people = useMemo(() => peopleFor(group, expense), [group, expense]);
  const start = useMemo(() => initialState(group, expense, people, draft), [group, expense, people, draft]);
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
  const [currency, setCurrency] = useState<CurrencyCode>(start.currency);
  const [pinned, setPinned] = useState<PinnedRate | null>(start.pinned);
  const [picking, setPicking] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>(start.items);
  const [extrasText, setExtrasText] = useState(start.extrasText);
  const amountField = useRef<TextInput>(null);

  // Paid in another currency: the ECB's rate for the day, unless one is pinned.
  const foreign = currency !== group.currency;
  const ecb = useEcbRate(currency, group.currency, date, foreign && !pinned);
  const rate = foreign ? (pinned?.rate ?? (ecb.status === 'ready' ? ecb.quote.rate : null)) : null;
  // Itemised, the amount is what the items and extras come to; otherwise it's what was typed, sums and all.
  const itemised: Extract<Split, { kind: 'items' }> | null =
    kind === 'items'
      ? {
          kind,
          items: items.map((item) => ({
            id: item.key,
            label: item.label.trim(),
            amount: readAmount(item.amountText, currency) ?? 0,
            among: people.map((member) => member.id).filter((id) => item.among.includes(id)),
          })),
          extras: readAmount(extrasText, currency) ?? 0,
        }
      : null;
  const typed = readAmount(amountText, currency);
  const amount = itemised ? itemsTotal(itemised) : (typed ?? 0);
  const converted = !foreign ? amount : rate ? convert(amount, currency, group.currency, rate) : null;
  const amountInvalid = !itemised && amountText.trim() !== '' && typed === null;
  const badPrice = itemised ? [...items.map((item) => item.amountText), extrasText].some((text) => text.trim() !== '' && readAmount(text, currency) === null) : false;
  const split: Split =
    itemised ??
    (kind === 'equal'
      ? { kind, among: people.map((member) => member.id).filter((id) => among.includes(id)) }
      : kind === 'shares'
        ? { kind, shares }
        : { kind: 'exact', amounts: Object.fromEntries(Object.entries(exactTexts).map(([id, text]) => [id, readAmount(text, currency) ?? 0])) });
  const conversionProblem =
    !foreign || amount === 0
      ? null
      : converted === null
        ? ecb.status === 'loading'
          ? 'Looking up the exchange rate…'
          : 'Enter the exchange rate.'
        : converted === 0
          ? `That’s less than the smallest amount in ${group.currency}.`
          : converted > MAX_AMOUNT
            ? `That’s more than Quits can hold in ${group.currency}.`
            : null;
  const problem = amountInvalid
    ? 'That isn’t a valid amount.'
    : badPrice
      ? 'One of the prices isn’t a valid amount.'
    : description.trim() === ''
      ? 'Say what it was for.'
      : (splitProblem(amount, split, currency) ?? conversionProblem);
  const preview = amount > 0 && (kind !== 'exact' || problem === null) ? sharesOf(amount, split) : {};
  const chooseKind = (next: SplitKind) => {
    setKind(next);
    // Starting an itemised bill from an amount already typed: that's the first item.
    if (next === 'items' && items.length === 0) setItems([{ key: createId('i'), label: '', amountText: typed ? toInputString(typed, currency) : '', among: [] }]);
  };
  const nameOf = (id: string) => memberName(group, id);

  const close = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/group/[id]', params: { id: group.id } }));
  const save = () => {
    if (problem) return;
    const original = foreign && rate ? { amount, currency, rate } : undefined;
    const data = { description: description.trim(), amount: converted ?? 0, original, paidBy, split, category, date, note: note.trim() || undefined };
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
            <Pressable
              testID="expense-currency"
              accessibilityRole="button"
              accessibilityLabel={`Paid in ${CURRENCIES[currency].plural}`}
              accessibilityHint="Changes the currency it was paid in"
              onPress={() => setPicking(true)}
              hitSlop={8}
              style={styles.currencyButton}
            >
              <Text style={[styles.currency, { color: theme.inkMuted }]}>{CURRENCIES[currency].symbol.trim()}</Text>
              <Icon name="caretDown" size={16} color={theme.inkMuted} />
            </Pressable>
            <Field
              ref={amountField}
              testID="amount"
              accessibilityLabel={itemised ? `Amount in ${CURRENCIES[currency].plural}, the items added up` : `Amount in ${CURRENCIES[currency].plural}`}
              value={itemised ? (amount > 0 ? toInputString(amount, currency) : '') : amountText}
              editable={!itemised}
              onChangeText={setAmountText}
              placeholder={CURRENCIES[currency].decimals === 0 ? '0' : '0.00'}
              inputMode="decimal"
              keyboardType="decimal-pad"
              autoFocus={!expense}
              bare
              style={[
                styles.amountInput,
                // Sized to its digits, so the currency symbol stays beside the number.
                { color: amountInvalid ? theme.negative : theme.ink, width: Math.max(1, ((itemised ? toInputString(amount, currency) : amountText) || '0').length) * 31 + 12 },
              ]}
            />
          </View>
          {itemised ? (
            <Text variant="caption" tone="muted" style={styles.sum}>
              The items below add up to this.
            </Text>
          ) : (
            <View style={styles.calculator}>
              <View style={styles.operators}>
                {OPERATORS.map((operator) => (
                  <Pressable
                    key={operator.name}
                    accessibilityRole="button"
                    accessibilityLabel={`Type ${operator.name}`}
                    testID={`operator-${operator.name.replace(/ /g, '-')}`}
                    onPress={() => {
                      setAmountText((text) => text + operator.typed);
                      amountField.current?.focus();
                    }}
                    hitSlop={4}
                    style={[styles.operator, { backgroundColor: theme.sunken }]}
                  >
                    <Text variant="bodyStrong">{operator.shown}</Text>
                  </Pressable>
                ))}
              </View>
              {isSum(amountText) ? (
                <Text variant="label" tone={typed === null ? 'negative' : 'muted'} style={styles.sum} testID="amount-sum" accessibilityLiveRegion="polite">
                  {typed === null ? 'That sum doesn’t work out.' : `= ${formatMoney(typed, currency)}`}
                </Text>
              ) : null}
            </View>
          )}
          {foreign ? (
            <Conversion
              key={`${currency}-${pinned ? pinned.source : 'ecb'}`}
              amount={amount}
              from={currency}
              to={group.currency}
              date={date}
              rate={rate}
              converted={converted}
              pinned={pinned}
              ecb={ecb}
              onPin={setPinned}
            />
          ) : null}
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
          <Segmented label="How to split it" options={SPLITS} value={kind} onChange={chooseKind} />
          {itemised ? (
            <ItemsEditor
              group={group}
              people={people}
              currency={currency}
              items={items}
              onChange={setItems}
              extrasText={extrasText}
              onExtrasChange={setExtrasText}
              newKey={() => createId('i')}
            />
          ) : null}
          <Card style={styles.people}>
            {people.map((member, index) => {
              const share = preview[member.id];
              const included =
                kind === 'equal'
                  ? among.includes(member.id)
                  : kind === 'shares'
                    ? (shares[member.id] ?? 0) > 0
                    : kind === 'items'
                      ? (preview[member.id] ?? 0) > 0
                      : (readAmount(exactTexts[member.id] ?? '', currency) ?? 0) > 0;
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
      <CurrencyPicker
        visible={picking}
        value={currency}
        title="Paid in"
        onClose={() => setPicking(false)}
        onChange={(code) => {
          setCurrency(code);
          setPinned(null);
        }}
      />
    </Screen>
  );
}

export default function ExpenseScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId?: string }>();
  const group = useLastDefined(useGroup(id));
  const expense = useLastDefined(group?.expenses.find((item) => item.id === expenseId));
  // A draft handed over from quick add, taken once.
  const [draft] = useState(() => (expenseId ? null : useDraft.getState().take(id)));
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
  return <ExpenseForm key={expense?.id ?? 'new'} group={group} expense={expense} draft={draft} />;
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(1), paddingVertical: space(4) },
  currencyButton: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 48 },
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
  calculator: { alignItems: 'center', gap: space(2), marginTop: -space(2), marginBottom: space(4) },
  operators: { flexDirection: 'row', gap: space(2) },
  operator: { width: 44, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  sum: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  date: { marginTop: space(3) },
  note: { minHeight: 88, textAlignVertical: 'top' },
});
