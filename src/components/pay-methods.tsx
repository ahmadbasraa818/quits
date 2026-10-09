import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { nameOf } from '@/lib/members';
import { describePay, MAX_PAY_METHODS, PAY_KINDS, type PayKind, type PayMethod, parsePayMethod, samePay, SERVICES } from '@/lib/pay';
import type { Group } from '@/lib/types';
import { useGroups } from '@/store/groups';
import { radius, space, useTheme } from '@/theme';

import { Button, IconButton } from './button';
import { Chip } from './chip';
import { Field } from './field';
import { success, warning } from './haptics';
import { Icon } from './icon';
import { SectionLabel } from './layout';
import { Sheet } from './sheet';
import { Text } from './text';
import { useToast } from './toast';

/** What each kind of link does about the amount. */
const ABOUT: Record<PayKind, string> = {
  paypal: 'The amount is filled in, in any currency PayPal takes.',
  monzo: 'The amount is filled in for groups in pounds.',
  revolut: 'Whoever pays types in the amount.',
  venmo: 'The amount is filled in for groups in US dollars.',
  cashapp: 'Whoever pays types in the amount.',
  link: 'Any page that takes a payment, such as bunq.me or Wise. Whoever pays types in the amount.',
};

/** "How you get paid", "How Ben gets paid". */
export const payTitle = (group: Pick<Group, 'members' | 'me'>, memberId: string) => (memberId === group.me ? 'How you get paid' : `How ${nameOf(group, memberId)} gets paid`);

/** "PayPal", or "the link" for a pay link of their own. */
const serviceName = (kind: PayKind) => (kind === 'link' ? 'the link' : SERVICES[kind].name);

function AddPayMethod({ group, memberId, existing, visible, onClose }: { group: Group; memberId: string; existing: PayMethod[]; visible: boolean; onClose: () => void }) {
  const setPayMethods = useGroups((state) => state.setPayMethods);
  const showToast = useToast((state) => state.show);
  const [kind, setKind] = useState<PayKind>('paypal');
  const [text, setText] = useState('');
  const service = SERVICES[kind];
  const parsed = parsePayMethod(kind, text);
  const duplicate = parsed !== null && existing.some((method) => samePay(method, parsed));
  const problem =
    text.trim() === '' ? null : !parsed ? (kind === 'link' ? 'That doesn’t look like a link.' : `That doesn’t look like a ${service.name} name.`) : duplicate ? 'That’s already here.' : null;
  const close = () => {
    setText('');
    onClose();
  };
  const add = () => {
    if (!parsed || duplicate) return;
    setPayMethods(group.id, memberId, [...existing, parsed]);
    success();
    showToast(`Added ${serviceName(kind)}`);
    close();
  };
  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={payTitle(group, memberId)}
      testID="pay-sheet"
      footer={<Button label={`Add ${serviceName(kind)}`} icon="check" disabled={!parsed || duplicate} onPress={add} testID="save-pay" />}
    >
      <View style={styles.body}>
        <View style={styles.kinds} accessibilityRole="radiogroup" accessibilityLabel="Paid with">
          {PAY_KINDS.map((item) => (
            <Chip key={item} label={SERVICES[item].name} selected={item === kind} onPress={() => setKind(item)} testID={`pay-kind-${item}`} />
          ))}
        </View>
        <Field
          value={text}
          onChangeText={setText}
          placeholder={service.hint}
          accessibilityLabel={service.hint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={kind === 'link' ? 'url' : 'default'}
          returnKeyType="done"
          onSubmitEditing={add}
          testID="pay-handle"
        />
        <Text variant="caption" tone={problem ? 'negative' : 'muted'} style={styles.preview} testID="pay-preview" accessibilityLiveRegion="polite">
          {problem ?? (parsed ? `Opens ${describePay(parsed)}. ${ABOUT[kind]}` : ABOUT[kind])}
        </Text>
      </View>
    </Sheet>
  );
}

/**
 * How someone gets paid, on their page: the ways they've added, each with a
 * remove that can be undone, and a sheet to add another.
 */
export function PayMethods({ group, memberId, startAdding = false }: { group: Group; memberId: string; startAdding?: boolean }) {
  const theme = useTheme();
  const setPayMethods = useGroups((state) => state.setPayMethods);
  const showToast = useToast((state) => state.show);
  const [adding, setAdding] = useState(startAdding);
  const methods = group.members.find((member) => member.id === memberId)?.pay ?? [];
  const isMe = memberId === group.me;
  const name = nameOf(group, memberId);

  const remove = (index: number) => {
    const method = methods[index];
    const before = setPayMethods(group.id, memberId, methods.filter((_, item) => item !== index));
    warning();
    showToast(`Removed ${serviceName(method.kind)}`, { label: 'Undo', onPress: () => setPayMethods(group.id, memberId, before) });
  };

  return (
    <View testID="pay-methods">
      <SectionLabel help="pay-links">{payTitle(group, memberId)}</SectionLabel>
      {methods.length > 0 ? (
        <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.line }]}>
          {methods.map((method, index) => (
            <View key={`${method.kind}-${method.handle}`} style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }]}>
              <View style={[styles.tile, { backgroundColor: theme.sunken }]}>
                <Icon name={method.kind === 'link' ? 'link' : 'wallet'} size={18} color={theme.ink} />
              </View>
              <View style={styles.text} accessible accessibilityLabel={`${SERVICES[method.kind].name}: ${describePay(method)}`}>
                <Text variant="bodyStrong">{SERVICES[method.kind].name}</Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {describePay(method)}
                </Text>
              </View>
              <IconButton icon="trash" label={`Remove ${SERVICES[method.kind].name}: ${describePay(method)}`} onPress={() => remove(index)} testID={`remove-pay-${index}`} />
            </View>
          ))}
        </View>
      ) : (
        <Text variant="body" tone="muted">
          {isMe
            ? 'Add how you get paid, and whoever owes you gets a button to pay you, with the amount filled in where the service allows. Your reminders include it too.'
            : `Add how ${name} gets paid, and whoever owes ${name} gets a button to pay, with the amount filled in where the service allows.`}
        </Text>
      )}
      {methods.length < MAX_PAY_METHODS ? (
        <View style={styles.add}>
          <Button variant="ghost" compact icon="plus" label="Add a way to pay" onPress={() => setAdding(true)} testID="add-pay" />
        </View>
      ) : null}
      {methods.length > 0 ? (
        <Text variant="caption" tone="muted" style={styles.note}>
          Whoever owes {isMe ? 'you' : name} sees {methods.length === 1 ? 'this' : 'these'} on Settle up. {methods.length === 1 ? 'It goes' : 'They go'} with a shared copy of the group, and in
          reminders.
        </Text>
      ) : null}
      <AddPayMethod group={group} memberId={memberId} existing={methods} visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space(5), paddingBottom: space(2) },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginBottom: space(4) },
  preview: { marginTop: space(2) },
  panel: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingLeft: space(3), paddingRight: space(1), paddingVertical: space(2) },
  tile: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  add: { alignItems: 'flex-start', marginTop: space(3) },
  note: { marginTop: space(2) },
});
