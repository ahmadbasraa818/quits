import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { categoryOf } from '@/lib/categories';
import { dayLabel } from '@/lib/dates';
import { convert, describeRate } from '@/lib/fx';
import { activeMembers, nameOf } from '@/lib/members';
import { CURRENCIES, formatMoney } from '@/lib/money';
import { parseQuickAdd, QuickDraft } from '@/lib/quick-add';
import { sharesOf } from '@/lib/split';
import type { Group } from '@/lib/types';
import { useDraft } from '@/store/draft';
import { useGroups } from '@/store/groups';
import { useEcbRate } from '@/store/rates';
import { radius, space, useTheme } from '@/theme';

import { Avatar } from './avatar';
import { Button } from './button';
import { Field } from './field';
import { success } from './haptics';
import { Icon, IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Sheet } from './sheet';
import { Text } from './text';
import { useToast } from './toast';

/** "You", "You and Aiko", "You, Aiko and Ben". */
const listNames = (group: Group, ids: string[]) => {
  const names = ids.map((id) => nameOf(group, id));
  return names.length <= 1 ? (names[0] ?? 'No one') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/** Sentences to try, made from the group's own people and currency. */
function examples(group: Group): string[] {
  const others = activeMembers(group).filter((member) => member.id !== group.me);
  const [first, second, third] = [others[0]?.name ?? 'Sam', others[1]?.name ?? others[0]?.name ?? 'Sam', others[2]?.name ?? others[0]?.name ?? 'Sam'];
  const whole = CURRENCIES[group.currency].decimals === 0;
  const symbol = CURRENCIES[group.currency].symbol.trim();
  return [
    `Lunch ${symbol}${whole ? '2,400' : '24.50'} split with ${first}`,
    `${second} paid ${whole ? '3,600' : '36'} for a taxi yesterday`,
    `Drinks on me ${whole ? '5,000' : '50'} for everyone except ${third}`,
  ];
}

/** One line of what was understood: an icon, the words, and whether it was said or assumed. */
function Line({ icon, children, said, testID }: { icon: IconName; children: string; said: boolean; testID: string }) {
  const theme = useTheme();
  return (
    <View style={styles.line} testID={testID}>
      <Icon name={icon} size={18} color={said ? theme.ink : theme.inkMuted} />
      <Text variant={said ? 'bodyStrong' : 'body'} tone={said ? 'ink' : 'muted'} style={{ flex: 1 }}>
        {children}
      </Text>
      {said ? null : (
        <Text variant="caption" tone="muted">
          assumed
        </Text>
      )}
    </View>
  );
}

/**
 * Add an expense by typing it as you'd say it: "Ramen ¥4,800, Aiko paid,
 * split with Ben and me". What Quits understood shows as you type, with
 * anything it assumed marked, and the full form is a tap away.
 */
export function QuickAdd({ group, visible, onClose }: { group: Group; visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const addExpense = useGroups((state) => state.addExpense);
  const removeExpense = useGroups((state) => state.removeExpense);
  const hand = useDraft((state) => state.hand);
  const showToast = useToast((state) => state.show);
  const [text, setText] = useState('');
  const draft: QuickDraft = useMemo(() => parseQuickAdd(text, group), [text, group]);

  const foreign = draft.currency !== group.currency;
  const ecb = useEcbRate(draft.currency, group.currency, draft.date, foreign && draft.amount !== null);
  const rate = foreign && ecb.status === 'ready' ? ecb.quote.rate : null;
  const converted = draft.amount === null ? null : !foreign ? draft.amount : rate ? convert(draft.amount, draft.currency, group.currency, rate) : null;
  const each = draft.amount !== null && draft.among.length > 0 ? sharesOf(draft.amount, { kind: 'equal', among: draft.among }) : {};
  const shares = [...new Set(Object.values(each))];
  const missing = draft.amount === null ? 'an amount' : draft.description === '' ? 'what it was for' : null;
  const ready = missing === null && converted !== null && converted > 0 && draft.among.length > 0;

  const close = () => {
    setText('');
    onClose();
  };
  const save = () => {
    if (!ready || draft.amount === null || converted === null) return;
    const id = addExpense(group.id, {
      description: draft.description,
      amount: converted,
      original: foreign && rate ? { amount: draft.amount, currency: draft.currency, rate } : undefined,
      paidBy: draft.paidBy,
      split: { kind: 'equal', among: draft.among },
      category: draft.category,
      date: draft.date,
    });
    success();
    showToast(`Added ${draft.description}`, { label: 'Undo', onPress: () => removeExpense(group.id, id) });
    close();
  };
  const openForm = () => {
    hand(group.id, draft);
    close();
    router.push({ pathname: '/group/[id]/expense', params: { id: group.id } });
  };

  const amountWords =
    draft.amount === null
      ? 'Add an amount, like 4,800'
      : `${formatMoney(draft.amount, draft.currency)}${
          !foreign
            ? ''
            : converted !== null && rate
              ? `, which is ${formatMoney(converted, group.currency)} at ${describeRate(rate, rate.base === draft.currency ? group.currency : draft.currency)}`
              : ecb.status === 'unavailable'
                ? ': it needs a rate, so open the full form'
                : ', looking up the rate…'
        }`;
  const splitWords =
    draft.among.length === 0
      ? 'No one to split with'
      : `${listNames(group, draft.among)}${draft.amount !== null ? ` · ${shares.length === 1 ? `${formatMoney(shares[0], draft.currency)} each` : 'about equal'}` : ''}`;

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Quick add"
      tall
      testID="quick-add"
      footer={
        <View style={styles.actions}>
          <Button label="Add expense" icon="check" disabled={!ready} onPress={save} testID="quick-save" />
          <Button label="Open in the full form" icon="pencilLine" variant="ghost" onPress={openForm} testID="quick-form" />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Field
          testID="quick-text"
          accessibilityLabel="Describe the expense"
          placeholder="Ramen ¥4,800, Aiko paid, split with Ben and me"
          value={text}
          onChangeText={setText}
          autoFocus
          multiline
          autoCorrect={false}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={save}
          leading={<Icon name="magicWand" size={18} color={theme.inkMuted} />}
          style={styles.input}
        />

        {text.trim() === '' ? (
          <View style={styles.examples}>
            <Text variant="caption" tone="muted">
              Write it as you’d say it. Try:
            </Text>
            {examples(group).map((example) => (
              <PressableScale
                key={example}
                accessibilityRole="button"
                accessibilityLabel={`Try: ${example}`}
                onPress={() => setText(example)}
                style={[styles.example, { borderColor: theme.line, backgroundColor: theme.card }]}
              >
                <Text variant="label">{example}</Text>
              </PressableScale>
            ))}
          </View>
        ) : (
          <View
            style={[styles.preview, { backgroundColor: theme.card, borderColor: theme.line }]}
            accessibilityLiveRegion="polite"
            accessible
            accessibilityLabel={`Quits read: ${amountWords}. ${draft.description || 'No description yet'}. Paid by ${nameOf(group, draft.paidBy)}. Split between ${splitWords}. ${dayLabel(draft.date)}.`}
            testID="quick-preview"
          >
            <Line icon="receipt" said={draft.said.amount} testID="quick-amount">
              {amountWords}
            </Line>
            <Line icon={categoryOf(draft.category).icon} said={draft.description !== ''} testID="quick-what">
              {draft.description === '' ? 'Say what it was for' : `${draft.description} · ${categoryOf(draft.category).label}`}
            </Line>
            <View style={styles.line} testID="quick-payer">
              <Avatar member={group.members.find((member) => member.id === draft.paidBy) ?? { name: '?', tone: 0 }} size={20} />
              <Text variant={draft.said.payer ? 'bodyStrong' : 'body'} tone={draft.said.payer ? 'ink' : 'muted'} style={{ flex: 1 }}>
                {nameOf(group, draft.paidBy)} paid
              </Text>
              {draft.said.payer ? null : (
                <Text variant="caption" tone="muted">
                  assumed
                </Text>
              )}
            </View>
            <Line icon="usersThree" said={draft.said.among} testID="quick-split">
              {splitWords}
            </Line>
            <Line icon="calendarBlank" said={draft.said.date} testID="quick-date">
              {dayLabel(draft.date)}
            </Line>
            {draft.strangers.length > 0 ? (
              <View style={styles.warning}>
                <Icon name="warningCircle" size={18} color={theme.negative} />
                <Text variant="label" tone="negative" style={{ flex: 1 }} testID="quick-strangers">
                  {draft.strangers.join(' and ')} {draft.strangers.length === 1 ? 'isn’t' : 'aren’t'} in {group.name}. Add them in group settings first.
                </Text>
              </View>
            ) : null}
          </View>
        )}
        {text.trim() !== '' && missing ? (
          <Text variant="caption" tone="muted" style={styles.hint}>
            Still needed: {missing}.
          </Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space(5), paddingBottom: space(4), gap: space(4) },
  input: { minHeight: 76, textAlignVertical: 'top', fontSize: 18 },
  examples: { gap: space(2) },
  example: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(4) },
  preview: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space(4), gap: space(3) },
  line: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2), marginTop: space(1) },
  actions: { gap: space(2) },
  hint: { marginTop: -space(2) },
});
