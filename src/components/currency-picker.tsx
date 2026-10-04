import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { CURRENCIES, CurrencyCode, searchCurrencies } from '@/lib/money';
import { radius, space, useTheme } from '@/theme';

import { Field } from './field';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Sheet } from './sheet';
import { Text } from './text';

/** The symbol in a small tile, so the list scans by shape as well as name. */
function SymbolTile({ code }: { code: CurrencyCode }) {
  const theme = useTheme();
  const symbol = CURRENCIES[code].symbol.trim();
  return (
    <View style={[styles.tile, { backgroundColor: theme.sunken }]}>
      <Text variant={symbol.length > 2 ? 'caption' : 'bodyStrong'} numberOfLines={1}>
        {symbol}
      </Text>
    </View>
  );
}

/** A searchable list of every currency Quits knows, in a sheet. */
export function CurrencyPicker({
  visible,
  value,
  onChange,
  onClose,
  title = 'Currency',
}: {
  visible: boolean;
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  onClose: () => void;
  title?: string;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const results = searchCurrencies(query);
  const close = () => {
    setQuery('');
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={close} title={title} tall testID="currency-picker">
      <View style={styles.search}>
        <Field
          testID="currency-search"
          accessibilityLabel="Search currencies"
          placeholder="Search by name or code"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(code) => code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        accessibilityRole="radiogroup"
        accessibilityLabel={title}
        ListEmptyComponent={
          <Text variant="body" tone="muted" style={styles.empty}>
            No currency matches “{query.trim()}”.
          </Text>
        }
        renderItem={({ item: code }) => {
          const selected = code === value;
          return (
            <PressableScale
              testID={`currency-${code}`}
              accessibilityRole="radio"
              aria-checked={selected}
              accessibilityLabel={`${CURRENCIES[code].name}, ${code}`}
              onPress={() => {
                onChange(code);
                close();
              }}
              style={[styles.row, selected && { backgroundColor: theme.card, borderColor: theme.line }]}
            >
              <SymbolTile code={code} />
              <View style={styles.names}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {CURRENCIES[code].name}
                </Text>
                <Text variant="caption" tone="muted">
                  {code}
                </Text>
              </View>
              {selected ? <Icon name="check" size={20} color={theme.ink} /> : null}
            </PressableScale>
          );
        }}
      />
    </Sheet>
  );
}

/** A row showing a currency, which opens the picker. */
export function CurrencyField({
  value,
  onChange,
  disabled = false,
  label = 'Currency',
}: {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  disabled?: boolean;
  label?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableScale
        testID="currency-field"
        haptic
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${CURRENCIES[value].name}, ${value}`}
        accessibilityHint={disabled ? undefined : 'Opens a list of currencies'}
        aria-disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <SymbolTile code={value} />
        <View style={styles.names}>
          <Text variant="bodyStrong">{CURRENCIES[value].name}</Text>
          <Text variant="caption" tone="muted">
            {value}
          </Text>
        </View>
        {disabled ? null : <Icon name="caretDown" size={18} color={theme.inkMuted} />}
      </PressableScale>
      <CurrencyPicker visible={open} value={value} onChange={onChange} onClose={() => setOpen(false)} title={label} />
    </>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: space(5), paddingBottom: space(2) },
  list: { paddingHorizontal: space(3), paddingBottom: space(6) },
  empty: { textAlign: 'center', paddingVertical: space(8) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2.5),
    paddingHorizontal: space(2),
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  tile: { width: 44, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  names: { flex: 1, gap: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(3),
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
