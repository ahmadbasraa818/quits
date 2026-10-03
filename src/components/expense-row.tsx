import { StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { categoryOf } from '@/lib/categories';
import { formatMoney } from '@/lib/money';
import { sharesOf } from '@/lib/split';
import type { Expense, Group } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

/** What an expense did to your balance: what you lent, or what you owe. */
export function yourPart(expense: Expense, me: string): { kind: 'lent' | 'owe' | 'none'; amount: number } {
  const share = sharesOf(expense.amount, expense.split)[me] ?? 0;
  if (expense.paidBy === me) {
    const lent = expense.amount - share;
    return lent > 0 ? { kind: 'lent', amount: lent } : { kind: 'none', amount: 0 };
  }
  return share > 0 ? { kind: 'owe', amount: share } : { kind: 'none', amount: 0 };
}

export function ExpenseRow({ expense, group, onPress, onDelete }: { expense: Expense; group: Group; onPress: () => void; onDelete: () => void }) {
  const theme = useTheme();
  const category = categoryOf(expense.category);
  const payer = expense.paidBy === group.me ? 'You' : group.members.find((member) => member.id === expense.paidBy)?.name ?? 'Someone';
  const part = yourPart(expense, group.me);
  const partText =
    part.kind === 'lent'
      ? `you lent ${formatMoney(part.amount, group.currency)}`
      : part.kind === 'owe'
        ? `you owe ${formatMoney(part.amount, group.currency)}`
        : 'not involved';

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={64}
      overshootRight={false}
      renderRightActions={() => (
        <View style={styles.deleteAction}>
          <PressableScale accessibilityRole="button" accessibilityLabel={`Delete ${expense.description}`} onPress={onDelete} style={[styles.deleteButton, { backgroundColor: theme.negative }]}>
            <Icon name="trash" size={20} color="#FFFFFF" />
            <Text variant="caption" style={{ color: '#FFFFFF' }}>
              Delete
            </Text>
          </PressableScale>
        </View>
      )}
    >
      <PressableScale
        testID={`expense-${expense.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${expense.description}, ${formatMoney(expense.amount, group.currency)}, paid by ${payer}, ${partText}`}
        accessibilityHint="Opens the expense to edit it"
        onPress={onPress}
        style={[styles.row, { backgroundColor: theme.card }]}
      >
        <View style={[styles.tile, { backgroundColor: theme.sunken }]}>
          <Icon name={category.icon} size={20} color={theme.ink} />
        </View>
        <View style={styles.middle}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {expense.description}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {payer === 'You' ? 'You paid' : `${payer} paid`}
          </Text>
        </View>
        <View style={styles.end}>
          <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
            {formatMoney(expense.amount, group.currency)}
          </Text>
          <Text variant="caption" tone={part.kind === 'lent' ? 'positive' : part.kind === 'owe' ? 'negative' : 'muted'} style={{ fontVariant: ['tabular-nums'] }}>
            {partText}
          </Text>
        </View>
      </PressableScale>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), paddingHorizontal: space(3) },
  tile: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, gap: 2 },
  end: { alignItems: 'flex-end', gap: 2 },
  deleteAction: { justifyContent: 'center' },
  deleteButton: { width: 88, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 2 },
});
