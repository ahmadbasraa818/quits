import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { dayLabel } from '@/lib/dates';
import { describeRate, invertedValue, parseRateValue, quoteOf, Rate } from '@/lib/fx';
import { CURRENCIES, CurrencyCode, formatMoney } from '@/lib/money';
import type { EcbRate } from '@/store/rates';
import { radius, space, useTheme } from '@/theme';

import { Button, IconButton } from './button';
import { Field } from './field';
import { Text } from './text';

/** A rate someone fixed: typed in, or kept from when the expense was saved. */
export type PinnedRate = { rate: Rate; source: 'typed' | 'saved' };

/** A day as it reads mid-sentence: "today", "Fri 2 Oct". */
const inSentence = (date: string) => {
  const label = dayLabel(date);
  return ['Today', 'Yesterday', 'Tomorrow'].includes(label) ? label.toLowerCase() : label;
};

function sourceLine(pinned: PinnedRate | null, ecb: EcbRate, date: string): string {
  if (pinned?.source === 'typed') return 'Your rate';
  if (pinned?.source === 'saved') return 'The rate it was saved with';
  if (ecb.status === 'ready') {
    // On a weekend or holiday the ECB's latest rate is from an earlier day.
    return ecb.quote.date === date ? `ECB rate for ${inSentence(date)}` : `ECB rate for ${inSentence(ecb.quote.date)}, the latest before ${inSentence(date)}`;
  }
  return '';
}

function unavailableLine(ecb: EcbRate, from: CurrencyCode, to: CurrencyCode): string | null {
  if (ecb.status !== 'unavailable') return null;
  if (ecb.reason === 'unsupported') {
    const missing = CURRENCIES[from].liveRate ? to : from;
    return `The ECB doesn’t publish a rate for ${CURRENCIES[missing].plural}, so enter it yourself.`;
  }
  return ecb.reason === 'offline' ? 'No connection to look up the rate. Enter it yourself, or try again.' : 'The rate couldn’t be looked up. Enter it yourself, or try again.';
}

/**
 * What an amount paid in another currency comes to in the group's, and the
 * rate behind it: the European Central Bank's for the expense's date, one
 * typed in, or the one an expense was saved with.
 */
export function Conversion({
  amount,
  from,
  to,
  date,
  rate,
  converted,
  pinned,
  ecb,
  onPin,
}: {
  /** Minor units of `from`. */
  amount: number;
  from: CurrencyCode;
  to: CurrencyCode;
  date: string;
  rate: Rate | null;
  /** Minor units of `to`, or null while there's no rate. */
  converted: number | null;
  pinned: PinnedRate | null;
  ecb: EcbRate;
  onPin: (pinned: PinnedRate | null) => void;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  // With nothing to go on, a rate reads best as one of the group's currency: "£1 = ₫33,000".
  const [base, setBase] = useState<CurrencyCode>(rate?.base ?? to);
  const [text, setText] = useState(rate?.value ?? '');
  const quote = base === from ? to : from;
  const unavailable = unavailableLine(ecb, from, to);
  const showEditor = editing || (!rate && ecb.status === 'unavailable');
  const typed = parseRateValue(text);

  const startEditing = () => {
    setBase(rate?.base ?? to);
    setText(rate?.value ?? '');
    setEditing(true);
  };
  const swap = () => {
    setBase(quote);
    setText(typed ? invertedValue(typed) : '');
  };
  const useTyped = () => {
    if (!typed) return;
    onPin({ rate: { base, value: typed }, source: 'typed' });
    setEditing(false);
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]} testID="conversion">
      <View style={styles.top} accessibilityLiveRegion="polite">
        {converted !== null ? (
          <Text variant="title" style={styles.figure} testID="converted" accessibilityLabel={`Comes to ${formatMoney(converted, to)}`}>
            = {formatMoney(converted, to)}
          </Text>
        ) : (
          <Text variant="title" tone="muted" style={styles.figure}>
            = {CURRENCIES[to].symbol.trim()} …
          </Text>
        )}
        {ecb.status === 'loading' && !pinned ? <ActivityIndicator color={theme.inkMuted} /> : null}
      </View>

      {rate ? (
        <Text variant="label" testID="rate">
          {describeRate(rate, quoteOf(rate, from, to))}
          <Text variant="label" tone="muted">
            {' · '}
            {sourceLine(pinned, ecb, date)}
          </Text>
        </Text>
      ) : ecb.status === 'loading' ? (
        <Text variant="label" tone="muted">
          Looking up the ECB rate for {inSentence(date)}…
        </Text>
      ) : null}
      {unavailable && !pinned ? (
        <Text variant="caption" tone="muted" testID="rate-unavailable">
          {unavailable}
        </Text>
      ) : null}

      {showEditor ? (
        <View style={styles.editor}>
          <View style={styles.editorRow}>
            <Text variant="bodyStrong" style={styles.side} numberOfLines={1}>
              {formatMoney(10 ** CURRENCIES[base].decimals, base).replace(/\.0+$/, '')} =
            </Text>
            <Field
              testID="rate-input"
              accessibilityLabel={`How many ${CURRENCIES[quote].plural} one ${CURRENCIES[base].name} buys`}
              value={text}
              onChangeText={setText}
              placeholder="0.00"
              inputMode="decimal"
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={useTyped}
              style={styles.rateField}
            />
            <Text variant="bodyStrong" style={styles.side} numberOfLines={1}>
              {CURRENCIES[quote].symbol.trim()}
            </Text>
            <IconButton icon="arrowsDownUp" label={`Enter it as one ${CURRENCIES[quote].name} in ${CURRENCIES[base].plural} instead`} onPress={swap} testID="swap-rate" />
          </View>
          {typed ? (
            // Read back what was typed, so "33,000" can't quietly mean 33.
            <Text variant="caption" tone="muted" testID="rate-preview">
              Reads as {describeRate({ base, value: typed }, quote)}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button compact label="Use this rate" icon="check" disabled={!typed} onPress={useTyped} testID="use-rate" />
            {editing ? <Button compact variant="ghost" label="Cancel" onPress={() => setEditing(false)} /> : null}
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          {rate ? <Button compact variant="secondary" icon="pencilSimple" label="Change rate" onPress={startEditing} testID="change-rate" /> : null}
          {pinned && ecb.status !== 'unavailable' ? (
            <Button compact variant="ghost" icon="arrowsClockwise" label="Use the ECB rate" onPress={() => onPin(null)} testID="use-ecb-rate" />
          ) : null}
        </View>
      )}
      {!pinned && ecb.status === 'unavailable' && ecb.reason !== 'unsupported' ? (
        <Button compact variant="ghost" icon="arrowsClockwise" label="Try again" onPress={ecb.retry} testID="retry-rate" />
      ) : null}
      {amount === 0 ? null : converted === 0 ? (
        <Text variant="caption" tone="negative">
          That’s less than the smallest amount in {to}.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space(4), gap: space(2), marginBottom: space(3) },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  figure: { fontVariant: ['tabular-nums'] },
  editor: { gap: space(3), marginTop: space(1) },
  editorRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  side: { fontVariant: ['tabular-nums'], flexShrink: 0 },
  rateField: { flex: 1, minWidth: 0, minHeight: 44, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
});
