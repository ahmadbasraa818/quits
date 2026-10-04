import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { formatMoney } from '@/lib/money';
import type { Group } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

function Bar({ fraction, positive }: { fraction: number; positive: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const width = useSharedValue(reduceMotion ? fraction : 0);
  useEffect(() => {
    width.set(reduceMotion ? fraction : withTiming(fraction, { duration: 500 }));
  }, [fraction, reduceMotion, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.get() * 100}%` }));
  return (
    <View style={styles.half}>
      <Animated.View style={[styles.fill, positive ? styles.fillRight : styles.fillLeft, { backgroundColor: positive ? theme.positive : theme.negative }, style]} />
    </View>
  );
}

/** Each person’s balance as a bar either side of zero: right if they’re owed, left if they owe. */
export function BalanceBars({ group, balance }: { group: Group; balance: Record<string, number> }) {
  const theme = useTheme();
  const rows = [...group.members].sort((a, b) => (balance[b.id] ?? 0) - (balance[a.id] ?? 0));
  const largest = Math.max(1, ...rows.map((member) => Math.abs(balance[member.id] ?? 0)));
  return (
    <View style={styles.list}>
      {rows.map((member) => {
        const amount = balance[member.id] ?? 0;
        const isMe = member.id === group.me;
        const name = isMe ? 'You' : member.name;
        const label =
          amount > 0
            ? `${name} ${isMe ? 'are' : 'is'} owed ${formatMoney(amount, group.currency)}`
            : amount < 0
              ? `${name} ${isMe ? 'owe' : 'owes'} ${formatMoney(-amount, group.currency)}`
              : `${name} ${isMe ? 'are' : 'is'} square`;
        return (
          <PressableScale
            key={member.id}
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint="Shows how it adds up"
            testID={`balance-${member.id}`}
            onPress={() => router.push({ pathname: '/group/[id]/member/[memberId]', params: { id: group.id, memberId: member.id } })}
          >
            <View style={styles.who}>
              <Avatar member={member} size={32} />
              <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
                {name}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: theme.sunken }]}>
              <View style={styles.halfLeft}>{amount < 0 ? <Bar fraction={-amount / largest} positive={false} /> : null}</View>
              <View style={[styles.axis, { backgroundColor: theme.inkMuted }]} />
              <View style={styles.halfRight}>{amount > 0 ? <Bar fraction={amount / largest} positive /> : null}</View>
            </View>
            <Text variant="label" tone={amount > 0 ? 'positive' : amount < 0 ? 'negative' : 'muted'} style={styles.amount}>
              {formatMoney(amount, group.currency, { signed: true })}
            </Text>
            <Icon name="caretRight" size={16} color={theme.inkMuted} />
          </PressableScale>
        );
      })}
      <Text variant="caption" tone="muted" style={{ marginTop: space(2) }}>
        Right of the line, the group owes them. Left, they owe the group. Tap anyone to see how it adds up.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space(4) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), minHeight: 44 },
  who: { width: 96, flexDirection: 'row', alignItems: 'center', gap: space(2) },
  name: { flexShrink: 1 },
  track: { flex: 1, height: 14, borderRadius: radius.pill, flexDirection: 'row', overflow: 'hidden' },
  halfLeft: { flex: 1, alignItems: 'flex-end' },
  halfRight: { flex: 1, alignItems: 'flex-start' },
  half: { flex: 1, width: '100%' },
  axis: { width: 2 },
  fill: { position: 'absolute', top: 0, bottom: 0 },
  fillLeft: { right: 0 },
  fillRight: { left: 0 },
  amount: { width: 92, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
