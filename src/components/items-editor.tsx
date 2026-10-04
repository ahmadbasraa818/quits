import { StyleSheet, View } from 'react-native';

import { nameOf } from '@/lib/members';
import { CURRENCIES, CurrencyCode } from '@/lib/money';
import type { Group, Member } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

import { Avatar } from './avatar';
import { Button, IconButton } from './button';
import { Field } from './field';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

/** An item as it's being typed: the price is still text, maybe a sum. */
export type ItemDraft = { key: string; label: string; amountText: string; among: string[] };

/**
 * The lines of an itemised bill: what each was, its price, and who had it,
 * then tax, service and tip, which are shared out in proportion to what
 * everyone had.
 */
export function ItemsEditor({
  group,
  people,
  currency,
  items,
  onChange,
  extrasText,
  onExtrasChange,
  newKey,
}: {
  group: Group;
  people: Member[];
  currency: CurrencyCode;
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  extrasText: string;
  onExtrasChange: (text: string) => void;
  /** A key for the next new item. */
  newKey: () => string;
}) {
  const theme = useTheme();
  const placeholder = CURRENCIES[currency].decimals === 0 ? '0' : '0.00';
  const update = (key: string, change: Partial<ItemDraft>) => onChange(items.map((item) => (item.key === key ? { ...item, ...change } : item)));
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={item.key} style={[styles.item, { backgroundColor: theme.card, borderColor: theme.line }]} testID={`item-${index}`}>
          <View style={styles.row}>
            <Field
              testID={`item-label-${index}`}
              accessibilityLabel={`Item ${index + 1}: what it was`}
              value={item.label}
              onChangeText={(label) => update(item.key, { label })}
              placeholder="What was it?"
              maxLength={40}
              style={styles.label}
            />
            <Field
              testID={`item-amount-${index}`}
              accessibilityLabel={`Item ${index + 1}: price`}
              value={item.amountText}
              onChangeText={(amountText) => update(item.key, { amountText })}
              placeholder={placeholder}
              inputMode="decimal"
              keyboardType="decimal-pad"
              style={styles.price}
            />
          </View>
          <View style={styles.row}>
            <View style={styles.people} accessibilityRole="none">
              {people.map((member) => {
                const had = item.among.includes(member.id);
                const name = nameOf(group, member.id);
                return (
                  <PressableScale
                    key={member.id}
                    testID={`item-${index}-${member.id}`}
                    accessibilityRole="checkbox"
                    aria-checked={had}
                    accessibilityLabel={`${name} had ${item.label.trim() || `item ${index + 1}`}`}
                    onPress={() => update(item.key, { among: had ? item.among.filter((id) => id !== member.id) : [...item.among, member.id] })}
                    style={[styles.person, { borderColor: had ? theme.brand : 'transparent', opacity: had ? 1 : 0.45 }]}
                  >
                    <Avatar member={member} size={30} />
                  </PressableScale>
                );
              })}
            </View>
            <IconButton icon="trash" label={`Remove item ${index + 1}`} onPress={() => onChange(items.filter((other) => other.key !== item.key))} />
          </View>
          {item.among.length === 0 ? (
            <Text variant="caption" tone="muted">
              Tap who had it.
            </Text>
          ) : null}
        </View>
      ))}
      <Button
        variant="ghost"
        compact
        icon="plus"
        label="Add an item"
        testID="add-item"
        onPress={() => onChange([...items, { key: newKey(), label: '', amountText: '', among: [] }])}
      />
      <View style={styles.extras}>
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          Tax, service and tip
        </Text>
        <Field
          testID="item-extras"
          accessibilityLabel="Tax, service and tip, shared in proportion to what everyone had"
          value={extrasText}
          onChangeText={onExtrasChange}
          placeholder={placeholder}
          inputMode="decimal"
          keyboardType="decimal-pad"
          style={styles.price}
        />
      </View>
      <Text variant="caption" tone="muted">
        Each item is split between whoever had it. Tax, service and tip are shared in proportion to what everyone had.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space(3), marginTop: space(3) },
  item: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space(3), gap: space(2.5) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  // minWidth 0 lets the field shrink below a text input's own width on the web.
  label: { flex: 1, minWidth: 0, minHeight: 44 },
  price: { width: 88, minHeight: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  people: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) },
  person: { borderWidth: 2, borderRadius: radius.pill, padding: 1 },
  extras: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
});
