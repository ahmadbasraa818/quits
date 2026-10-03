import type { TextProps } from 'react-native';

import { CurrencyCode, formatMoney } from '@/lib/money';

import { Text, TextTone, TextVariant } from './text';

/** An amount, with figures of equal width so columns of numbers line up. */
export function Money({
  amount,
  currency,
  variant = 'bodyStrong',
  tone,
  signed = false,
  colored = false,
  style,
  ...props
}: Omit<TextProps, 'children'> & {
  amount: number;
  currency: CurrencyCode;
  variant?: TextVariant;
  tone?: TextTone;
  signed?: boolean;
  /** Green for money owed to someone, red for money they owe. */
  colored?: boolean;
}) {
  const resolvedTone: TextTone = tone ?? (colored ? (amount > 0 ? 'positive' : amount < 0 ? 'negative' : 'muted') : 'ink');
  return (
    <Text {...props} variant={variant} tone={resolvedTone} style={[{ fontVariant: ['tabular-nums'] }, style]}>
      {formatMoney(amount, currency, { signed })}
    </Text>
  );
}
