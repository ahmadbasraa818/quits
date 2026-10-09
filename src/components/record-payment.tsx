import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { daysAgo } from '@/lib/dates';
import { nameInSentence, nameOf } from '@/lib/members';
import { readAmount } from '@/lib/calc';
import { CURRENCIES, formatMoney, MAX_AMOUNT, toInputString } from '@/lib/money';
import type { Group } from '@/lib/types';
import { useGroups } from '@/store/groups';
import { font, space, useTheme } from '@/theme';

import { Avatar } from './avatar';
import { Button } from './button';
import { DateField } from './calendar';
import { Chip } from './chip';
import { Field } from './field';
import { success } from './haptics';
import { SectionLabel } from './layout';
import { Sheet } from './sheet';
import { Text } from './text';
import { useToast } from './toast';

export type PaymentDraft = { from: string; to: string; amount?: number };

function PeopleChips({ group, value, onChange, label, testPrefix }: { group: Group; value: string; onChange: (id: string) => void; label: string; testPrefix: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {group.members.map((member) => (
        <Chip
          key={member.id}
          testID={`${testPrefix}-${member.id}`}
          label={nameOf(group, member.id)}
          selected={value === member.id}
          onPress={() => onChange(member.id)}
          leading={<Avatar member={member} size={24} />}
        />
      ))}
    </ScrollView>
  );
}

/**
 * Records money handed over: a whole suggested payment, part of one, or one
 * made outside the plan. Open it with a fresh `key` each time, so it starts
 * from the draft it's given.
 */
export function RecordPayment({ group, visible, draft, onClose }: { group: Group; visible: boolean; draft: PaymentDraft; onClose: () => void }) {
  const theme = useTheme();
  const recordPayment = useGroups((state) => state.recordPayment);
  const removePayment = useGroups((state) => state.removePayment);
  const showToast = useToast((state) => state.show);
  const [from, setFrom] = useState(draft.from);
  const [to, setTo] = useState(draft.to);
  const [amountText, setAmountText] = useState(draft.amount ? toInputString(draft.amount, group.currency) : '');
  const [date, setDate] = useState(daysAgo(0));
  const [note, setNote] = useState('');

  const amount = readAmount(amountText, group.currency);
  const problem =
    from === to
      ? 'Someone can’t pay themselves.'
      : amountText.trim() !== '' && amount === null
        ? 'That isn’t a valid amount.'
        : !amount
          ? 'Enter how much was paid.'
          : amount > MAX_AMOUNT
            ? 'That’s more than Quits can hold.'
            : null;
  const partial = draft.amount !== undefined && amount !== null && amount > 0 && amount < draft.amount && from === draft.from && to === draft.to;

  const save = () => {
    if (problem || !amount) return;
    const id = recordPayment(group.id, { from, to, amount, date, note: note.trim() || undefined });
    success();
    showToast(`Recorded ${formatMoney(amount, group.currency)} from ${nameInSentence(group, from)} to ${nameInSentence(group, to)}`, {
      label: 'Undo',
      onPress: () => removePayment(group.id, id),
    });
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Record a payment"
      tall
      testID="record-payment"
      footer={<Button label="Record payment" icon="check" disabled={problem !== null} onPress={save} testID="save-payment" />}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <SectionLabel>Who paid</SectionLabel>
        <PeopleChips group={group} value={from} onChange={setFrom} label="Who paid" testPrefix="payment-from" />
        <SectionLabel>Who got it</SectionLabel>
        <PeopleChips group={group} value={to} onChange={setTo} label="Who got it" testPrefix="payment-to" />
        <SectionLabel>How much</SectionLabel>
        <View style={[styles.amount, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <Text style={[styles.symbol, { color: theme.inkMuted }]}>{CURRENCIES[group.currency].symbol.trim()}</Text>
          <Field
            testID="payment-amount"
            accessibilityLabel={`Amount in ${CURRENCIES[group.currency].plural}`}
            value={amountText}
            onChangeText={setAmountText}
            placeholder={CURRENCIES[group.currency].decimals === 0 ? '0' : '0.00'}
            inputMode="decimal"
            keyboardType="decimal-pad"
            bare
            style={styles.amountInput}
          />
        </View>
        {partial && draft.amount !== undefined && amount !== null ? (
          <Text variant="caption" tone="muted" style={styles.hint} testID="payment-partial">
            Part of the {formatMoney(draft.amount, group.currency)}: {formatMoney(draft.amount - amount, group.currency)} will still be owed.
          </Text>
        ) : null}
        <SectionLabel>When</SectionLabel>
        <DateField value={date} onChange={setDate} label="Date paid" />
        <SectionLabel>Note</SectionLabel>
        <Field testID="payment-note" accessibilityLabel="Note" value={note} onChangeText={setNote} placeholder="Bank transfer, cash…" maxLength={80} />
        {problem && (amountText !== '' || from === to) ? (
          <Text variant="label" tone="negative" style={styles.hint} testID="payment-problem" accessibilityLiveRegion="polite">
            {problem}
          </Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space(5), paddingBottom: space(4) },
  chips: { gap: space(2), paddingRight: space(5) },
  amount: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(4), borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  symbol: { fontFamily: font.bold, fontSize: 22 },
  amountInput: { flex: 1, fontFamily: font.bold, fontSize: 22, fontVariant: ['tabular-nums'] },
  hint: { marginTop: space(2) },
});
