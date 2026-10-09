import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { directDebts } from '@/lib/balances';
import { dayLabel, daysAgo } from '@/lib/dates';
import { nameInSentence, nameOf } from '@/lib/members';
import { formatMoney } from '@/lib/money';
import { circlesExplanation, planText } from '@/lib/plan-text';
import type { Group, Member } from '@/lib/types';
import { useGroups } from '@/store/groups';
import type { GroupSummary } from '@/store/summary';
import { radius, space, useTheme } from '@/theme';

import { Avatar } from './avatar';
import { Button, IconButton } from './button';
import { Icon } from './icon';
import { Card, SectionLabel } from './layout';
import { Money } from './money';
import { PressableScale } from './pressable-scale';
import { PaymentDraft, RecordPayment } from './record-payment';
import { Segmented } from './segmented';
import { SettleGraph } from './settle-graph';
import { shareText } from './share';
import { Text } from './text';
import { useToast } from './toast';
import { HelpLink } from './help-link';

const memberOf = (group: Group, id: string): Member => group.members.find((member) => member.id === id) ?? { id, name: '?', tone: 0 };

/** "Aiko paid Ben", "You paid Ben", "Aiko paid you". */
const paidLine = (group: Group, from: string, to: string) => `${nameOf(group, from)} paid ${nameInSentence(group, to)}`;

/** The payments recorded so far, newest first, each with a delete that can be undone. */
function PaymentsMade({ group }: { group: Group }) {
  const theme = useTheme();
  const removePayment = useGroups((state) => state.removePayment);
  const restorePayment = useGroups((state) => state.restorePayment);
  const showToast = useToast((state) => state.show);
  const payments = [...group.payments].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  if (payments.length === 0) return null;
  return (
    <View testID="payments-made">
      <SectionLabel>Payments made</SectionLabel>
      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.line }]}>
        {payments.map((payment, index) => {
          const line = paidLine(group, payment.from, payment.to);
          return (
            <Animated.View
              key={payment.id}
              entering={FadeIn}
              exiting={FadeOut}
              layout={LinearTransition}
              style={[styles.payment, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }]}
            >
              <View style={styles.people} accessible accessibilityLabel={`${line} ${formatMoney(payment.amount, group.currency)}, ${dayLabel(payment.date)}${payment.note ? `, ${payment.note}` : ''}`}>
                <Avatar member={memberOf(group, payment.from)} size={28} />
                <Icon name="arrowRight" size={14} color={theme.inkMuted} />
                <Avatar member={memberOf(group, payment.to)} size={28} />
                <View style={styles.paymentText}>
                  <Text variant="label" numberOfLines={1}>
                    {line}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {dayLabel(payment.date)}
                    {payment.note ? ` · ${payment.note}` : ''}
                  </Text>
                </View>
                <Money amount={payment.amount} currency={group.currency} variant="label" />
              </View>
              <IconButton
                icon="trash"
                label={`Delete the payment: ${line} ${formatMoney(payment.amount, group.currency)}`}
                testID={`delete-payment-${payment.id}`}
                onPress={() => {
                  const removed = removePayment(group.id, payment.id);
                  if (removed) showToast(`Deleted the payment from ${nameInSentence(group, removed.from)}`, { label: 'Undo', onPress: () => restorePayment(group.id, removed) });
                }}
              />
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The fewest payments that square the group, drawn against paying back pair
 * by pair, with a way to record each one, or part of one, and a message to
 * send everyone.
 */
export function SettleUp({ group, summary }: { group: Group; summary: GroupSummary }) {
  const theme = useTheme();
  const recordPayment = useGroups((state) => state.recordPayment);
  const removePayment = useGroups((state) => state.removePayment);
  const showToast = useToast((state) => state.show);
  const [view, setView] = useState<'plan' | 'direct'>('plan');
  const [recording, setRecording] = useState<{ draft: PaymentDraft; key: number } | null>(null);
  const direct = useMemo(() => directDebts(group.expenses, group.payments), [group.expenses, group.payments]);
  const { transfers, method, circles } = summary.settlement;
  const record = (draft: PaymentDraft) => setRecording((current) => ({ draft, key: (current?.key ?? 0) + 1 }));
  const someoneElse = group.members.find((member) => member.id !== group.me && !member.left)?.id ?? group.me;
  const recordButton = <Button variant="secondary" icon="handCoins" label="Record a payment" onPress={() => record({ from: group.me, to: someoneElse })} testID="record-payment-button" />;

  const sheet = recording ? <RecordPayment key={recording.key} group={group} visible draft={recording.draft} onClose={() => setRecording(null)} /> : null;

  if (transfers.length === 0) {
    return (
      <View style={{ gap: space(4) }}>
        <View style={styles.empty}>
          <Icon name="checkCircle" size={48} color={theme.positive} />
          <Text variant="heading" accessibilityRole="header">
            Everyone’s square
          </Text>
          <Text variant="body" tone="muted" style={{ textAlign: 'center' }}>
            Nothing to settle in {group.name}.
          </Text>
        </View>
        <PaymentsMade group={group} />
        {sheet}
      </View>
    );
  }

  const count = transfers.length;
  const share = async () => {
    const result = await shareText(planText(group, transfers, summary.directCount));
    if (result === 'copied') showToast('Plan copied, ready to paste');
    else if (result === 'failed') showToast('Couldn’t share the plan from here');
  };

  return (
    <View style={{ gap: space(4) }}>
      <View style={{ gap: space(1) }}>
        <View style={styles.headline}>
          <Text variant="title" testID="settle-headline" style={styles.headlineText}>
            {count === 1 ? 'One payment settles everyone' : `${count} payments settle everyone`}
          </Text>
          <HelpLink id="fewest" />
        </View>
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
        <SettleGraph group={group} plan={transfers} direct={direct} view={view} />
      </Card>

      <View style={styles.rows}>
        {transfers.map((transfer) => {
          const verb = transfer.from === group.me ? 'pay' : 'pays';
          const sentence = `${nameOf(group, transfer.from)} ${verb} ${nameOf(group, transfer.to)}`;
          return (
            <Animated.View key={`${transfer.from}-${transfer.to}`} entering={FadeIn} exiting={FadeOut} layout={LinearTransition}>
              <Card style={styles.transfer}>
                <PressableScale
                  style={styles.transferPeople}
                  accessibilityRole="button"
                  accessibilityLabel={`${sentence} ${formatMoney(transfer.amount, group.currency)}`}
                  accessibilityHint="Records all or part of this payment"
                  onPress={() => record({ ...transfer })}
                  testID={`transfer-${transfer.from}-${transfer.to}`}
                >
                  <Avatar member={memberOf(group, transfer.from)} size={32} />
                  <Icon name="arrowRight" size={16} color={theme.inkMuted} />
                  <Avatar member={memberOf(group, transfer.to)} size={32} />
                  <View style={{ flex: 1, marginLeft: space(1) }}>
                    <Text variant="label" numberOfLines={1}>
                      {sentence}
                    </Text>
                    <Money amount={transfer.amount} currency={group.currency} variant="bodyStrong" />
                  </View>
                </PressableScale>
                <Button
                  compact
                  variant="secondary"
                  label="Mark paid"
                  testID={`pay-${transfer.from}-${transfer.to}`}
                  accessibilityHint={`Records that ${nameOf(group, transfer.from)} paid ${nameOf(group, transfer.to)} in full`}
                  onPress={() => {
                    const id = recordPayment(group.id, { ...transfer, date: daysAgo(0) });
                    showToast(`Recorded ${formatMoney(transfer.amount, group.currency)} to ${nameInSentence(group, transfer.to)}`, { label: 'Undo', onPress: () => removePayment(group.id, id) });
                  }}
                />
              </Card>
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.note}>
        <Icon name="sparkle" size={18} color={theme.inkMuted} />
        <Text variant="caption" tone="muted" style={{ flex: 1 }} testID="settle-explanation">
          {method === 'exact'
            ? circlesExplanation(group, circles)
            : 'A big group: Quits matches the largest debts first, so no one makes more than one payment more than they need to.'}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button icon="shareNetwork" label="Share the plan" onPress={share} testID="share-plan" />
        {recordButton}
      </View>

      <PaymentsMade group={group} />
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  headline: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2) },
  headlineText: { flex: 1 },
  rows: { gap: space(2) },
  transfer: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  transferPeople: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  note: { flexDirection: 'row', gap: space(2), alignItems: 'flex-start', paddingTop: space(1) },
  actions: { gap: space(2) },
  empty: { alignItems: 'center', gap: space(3), paddingTop: space(12), paddingBottom: space(6), paddingHorizontal: space(6) },
  panel: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  payment: { flexDirection: 'row', alignItems: 'center', gap: space(1), paddingLeft: space(3), paddingRight: space(1), paddingVertical: space(2) },
  people: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  paymentText: { flex: 1, marginLeft: space(1) },
});
