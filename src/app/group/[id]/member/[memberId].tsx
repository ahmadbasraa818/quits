import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { Card, Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { Money } from '@/components/money';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { categoryOf } from '@/lib/categories';
import { dayLabel } from '@/lib/dates';
import { statementFor, StatementLine, whoPaidWhoUsed } from '@/lib/insights';
import { nameInSentence, nameOf, standing } from '@/lib/members';
import { formatMoney } from '@/lib/money';
import type { Group } from '@/lib/types';
import { useGroup } from '@/store/groups';
import { radius, space, useTheme } from '@/theme';

function lineWords(group: Group, memberId: string, line: StatementLine): { title: string; detail: string } {
  if (line.kind === 'payment') {
    return line.direction === 'sent'
      ? { title: `Paid ${nameInSentence(group, line.other)}`, detail: dayLabel(line.date) }
      : { title: `Got from ${nameInSentence(group, line.other)}`, detail: dayLabel(line.date) };
  }
  const parts = [];
  if (line.paid > 0) parts.push(`paid ${formatMoney(line.paid, group.currency)}`);
  if (line.share > 0) parts.push(`share ${formatMoney(line.share, group.currency)}`);
  return { title: line.description, detail: `${dayLabel(line.date)} · ${parts.join(', ')}` };
}

function Statement({ group, memberId }: { group: Group; memberId: string }) {
  const theme = useTheme();
  const lines = useMemo(() => statementFor(group, memberId), [group, memberId]);
  const person = useMemo(() => whoPaidWhoUsed(group).find((entry) => entry.id === memberId), [group, memberId]);
  const member = group.members.find((item) => item.id === memberId);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/group/[id]', params: { id: group.id } }));
  if (!member || !person) {
    return (
      <Screen>
        <TopBar leading={{ icon: 'arrowLeft', label: 'Back', onPress: goBack }} />
        <Text variant="heading" accessibilityRole="header" style={{ textAlign: 'center', marginTop: space(10) }}>
          They aren’t in this group
        </Text>
      </Screen>
    );
  }
  const name = nameOf(group, memberId);
  const balance = person.balance;
  const summary = [
    { label: 'Paid for', amount: person.paid },
    { label: 'Their share', amount: -person.share },
    { label: 'Paid back', amount: person.sent },
    { label: 'Got back', amount: -person.received },
  ].filter((item) => item.amount !== 0);

  return (
    <Screen>
      <TopBar leading={{ icon: 'arrowLeft', label: 'Back', onPress: goBack }} title={name} />
      <Scroll>
        <View style={styles.header}>
          <Avatar member={member} size={64} />
          <View style={[styles.pill, { backgroundColor: balance > 0 ? theme.positive : balance < 0 ? theme.negative : theme.sunken }]}>
            <Text variant="label" style={{ color: balance === 0 ? theme.ink : theme.card }} testID="standing">
              {standing(group, memberId, balance)}
            </Text>
          </View>
          {member.left ? (
            <Text variant="caption" tone="muted">
              Has left the group
            </Text>
          ) : null}
        </View>

        <SectionLabel>How it adds up</SectionLabel>
        <Card style={{ gap: space(2) }}>
          {summary.map((item) => (
            <View key={item.label} style={styles.sumRow} accessible accessibilityLabel={`${item.label}: ${formatMoney(Math.abs(item.amount), group.currency)}`}>
              <Text variant="body" style={{ flex: 1 }}>
                {item.label}
              </Text>
              <Money amount={item.amount} currency={group.currency} variant="bodyStrong" signed colored />
            </View>
          ))}
          <View style={[styles.sumRow, styles.total, { borderTopColor: theme.line }]} accessible accessibilityLabel={`Balance: ${standing(group, memberId, balance)}`}>
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              Balance
            </Text>
            <Money amount={balance} currency={group.currency} variant="heading" signed colored testID="balance" />
          </View>
        </Card>

        <SectionLabel>Every expense and payment</SectionLabel>
        {lines.length === 0 ? (
          <Text variant="body" tone="muted">
            Nothing yet: {nameInSentence(group, memberId)} {memberId === group.me ? 'aren’t' : 'isn’t'} in any expense or payment.
          </Text>
        ) : (
          <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.line }]}>
            {lines.map((line, index) => {
              const words = lineWords(group, memberId, line);
              const row = (
                <View style={styles.line}>
                  <View style={[styles.tile, { backgroundColor: theme.sunken }]}>
                    <Icon name={line.kind === 'payment' ? 'handCoins' : categoryOf(line.category).icon} size={18} color={theme.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {words.title}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {words.detail}
                    </Text>
                  </View>
                  <Money amount={line.effect} currency={group.currency} variant="label" signed colored />
                </View>
              );
              const label = `${words.title}, ${words.detail}: ${formatMoney(line.effect, group.currency, { signed: true })}`;
              return (
                <View key={`${line.kind}-${line.id}`} style={index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line } : undefined}>
                  {line.kind === 'expense' ? (
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityHint="Opens the expense"
                      onPress={() => router.push({ pathname: '/group/[id]/expense', params: { id: group.id, expenseId: line.id } })}
                    >
                      {row}
                    </PressableScale>
                  ) : (
                    <View accessible accessibilityLabel={label}>
                      {row}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
        <Text variant="caption" tone="muted" style={styles.footnote}>
          Plus means the group owes {nameInSentence(group, memberId)} more; minus, less. Together they come to the balance.
        </Text>
      </Scroll>
    </Screen>
  );
}

export default function MemberScreen() {
  const { id, memberId } = useLocalSearchParams<{ id: string; memberId: string }>();
  const group = useGroup(id);
  if (!group) {
    return (
      <Screen>
        <TopBar leading={{ icon: 'arrowLeft', label: 'Back', onPress: () => router.replace('/') }} />
        <Text variant="heading" accessibilityRole="header" style={{ textAlign: 'center', marginTop: space(10) }}>
          This group isn’t here
        </Text>
      </Screen>
    );
  }
  return <Statement group={group} memberId={memberId} />;
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: space(3), paddingTop: space(2), paddingBottom: space(2) },
  pill: { borderRadius: radius.pill, paddingVertical: space(1.5), paddingHorizontal: space(3.5) },
  sumRow: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  total: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space(3), marginTop: space(1) },
  panel: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  line: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), paddingHorizontal: space(3) },
  tile: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  footnote: { marginTop: space(3) },
});
