import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { saveTextFile } from '@/components/backup-file';
import { Button, IconButton } from '@/components/button';
import { Chip } from '@/components/chip';
import { ConfirmDialog } from '@/components/confirm';
import { CurrencyField } from '@/components/currency-picker';
import { Field } from '@/components/field';
import { success, warning } from '@/components/haptics';
import { Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { useLastDefined } from '@/hooks/use-last-defined';
import { csvFileName, groupCsv } from '@/lib/csv';
import { localDate } from '@/lib/dates';
import { hasHistory, MAX_MEMBERS, namesProblem, nextTone } from '@/lib/members';
import type { CurrencyCode } from '@/lib/money';
import type { Group } from '@/lib/types';
import { useGroup, useGroups } from '@/store/groups';
import { summarise } from '@/store/summary';
import { space } from '@/theme';

type Person = { key: string; id?: string; name: string; left: boolean; history: boolean; tone: number };

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function GroupSettings({ group }: { group: Group }) {
  const editGroup = useGroups((state) => state.editGroup);
  const deleteGroup = useGroups((state) => state.deleteGroup);
  const restoreGroup = useGroups((state) => state.restoreGroup);
  const setArchived = useGroups((state) => state.setArchived);
  const showToast = useToast((state) => state.show);
  const [name, setName] = useState(group.name);
  const [currency, setCurrency] = useState<CurrencyCode>(group.currency);
  const [people, setPeople] = useState<Person[]>(() =>
    group.members
      .filter((member) => member.id !== group.me)
      .map((member) => ({ key: member.id, id: member.id, name: member.name, left: Boolean(member.left), history: hasHistory(group, member.id), tone: member.tone }))
  );
  const [confirming, setConfirming] = useState(false);
  const [newKeys, setNewKeys] = useState(0);

  const empty = group.expenses.length === 0 && group.payments.length === 0;
  const original = group.members.filter((member) => member.id !== group.me);
  const changed =
    name !== group.name ||
    currency !== group.currency ||
    people.length !== original.length ||
    people.some((person, index) => person.id !== original[index]?.id || person.name !== original[index]?.name || person.left !== Boolean(original[index]?.left));
  const problem = name.trim() === '' ? 'Give the group a name.' : people.length === 0 ? 'A group needs at least one other person.' : namesProblem(people.map((person) => person.name));
  const close = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/group/[id]', params: { id: group.id } }));
  const update = (key: string, change: Partial<Person>) => setPeople((current) => current.map((person) => (person.key === key ? { ...person, ...change } : person)));

  const save = () => {
    if (problem || !changed) return;
    editGroup(group.id, {
      name,
      currency,
      members: [{ id: group.me, name: 'You' }, ...people.map((person) => ({ id: person.id, name: person.name, left: person.left }))],
    });
    success();
    showToast('Group updated');
    close();
  };

  const archive = () => {
    setArchived(group.id, true);
    success();
    router.dismissTo('/');
    showToast(`Archived ${group.name}`, { label: 'Undo', onPress: () => setArchived(group.id, false) });
  };
  const bringBack = () => {
    setArchived(group.id, false);
    success();
    showToast(`${group.name} is back in your groups`);
  };
  const exportCsv = async () => {
    try {
      await saveTextFile(csvFileName(group, localDate(new Date())), groupCsv(group), 'csv');
    } catch {
      showToast('Couldn’t save the spreadsheet');
    }
  };
  const settled = summarise(group).settlement.transfers.length === 0;

  const remove = () => {
    setConfirming(false);
    router.dismissTo('/');
    const deleted = deleteGroup(group.id);
    if (deleted) {
      warning();
      showToast(`Deleted ${deleted.group.name}`, { label: 'Undo', onPress: () => restoreGroup(deleted.group, deleted.index) });
    }
  };

  return (
    <Screen footer={<Button label="Save changes" icon="check" disabled={!changed || problem !== null} onPress={save} testID="save-group" />}>
      <TopBar title="Group settings" leading={{ icon: 'x', label: 'Close', onPress: close }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Scroll>
          <SectionLabel>Name</SectionLabel>
          <Field testID="group-name" accessibilityLabel="Group name" value={name} onChangeText={setName} maxLength={40} />

          <SectionLabel>Currency</SectionLabel>
          <CurrencyField value={currency} onChange={setCurrency} disabled={!empty} label="Group currency" />
          {!empty ? (
            <Text variant="caption" tone="muted" style={styles.caption}>
              Every amount in the group is in {currency}, so it can’t change once there are expenses. Each expense can still be paid in another currency.
            </Text>
          ) : null}

          <SectionLabel>People</SectionLabel>
          <View style={styles.people}>
            <View style={styles.person}>
              <Avatar member={{ name: 'You', tone: 0 }} size={36} />
              <Text variant="bodyStrong">You</Text>
            </View>
            {people.map((person, index) => (
              <View key={person.key} style={styles.personBlock}>
                <View style={styles.person}>
                  <Avatar member={{ name: person.name || '?', tone: person.tone }} size={36} />
                  <Field
                    testID={`member-${index}`}
                    accessibilityLabel={person.id ? `Name for ${person.name || 'this person'}` : `New person ${index + 1}`}
                    value={person.name}
                    onChangeText={(text) => update(person.key, { name: text })}
                    placeholder="Their name"
                    maxLength={24}
                    autoFocus={!person.id}
                    style={{ flex: 1 }}
                  />
                  {person.history ? (
                    <Chip
                      label="Has left"
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${person.name || 'They'} left the group`}
                      selected={person.left}
                      onPress={() => update(person.key, { left: !person.left })}
                      testID={`left-${index}`}
                    />
                  ) : (
                    <IconButton
                      icon="userMinus"
                      label={`Remove ${person.name || 'this person'}`}
                      onPress={() => setPeople((current) => current.filter((item) => item.key !== person.key))}
                      testID={`remove-${index}`}
                    />
                  )}
                </View>
                {person.history && person.left ? (
                  <Text variant="caption" tone="muted" style={styles.leftNote}>
                    Stays in the balances and the history, but isn’t offered for new expenses.
                  </Text>
                ) : null}
              </View>
            ))}
            {people.length + 1 < MAX_MEMBERS ? (
              <Button
                variant="ghost"
                compact
                icon="userPlus"
                label="Add someone"
                testID="add-member"
                onPress={() => {
                  setNewKeys((count) => count + 1);
                  setPeople((current) => [...current, { key: `new-${newKeys}`, name: '', left: false, history: false, tone: nextTone([{ tone: 0 }, ...current]) }]);
                }}
              />
            ) : null}
          </View>
          {problem && changed ? (
            <Text variant="label" tone="negative" style={styles.caption} testID="settings-problem" accessibilityLiveRegion="polite">
              {problem}
            </Text>
          ) : (
            <Text variant="caption" tone="muted" style={styles.caption}>
              People with expenses or payments can’t be removed, so the history stays true. Mark them as left instead.
            </Text>
          )}

          <SectionLabel help="csv">Export</SectionLabel>
          <Button variant="secondary" icon="fileCsv" label="Export as a spreadsheet" onPress={exportCsv} testID="export-csv" />
          <Text variant="caption" tone="muted" style={styles.caption}>
            Every expense and payment as a CSV file, with what each did to everyone’s balance.
          </Text>

          <SectionLabel help="archive">Archive</SectionLabel>
          {group.archived ? (
            <Button variant="secondary" icon="arrowUUpLeft" label="Bring back to your groups" onPress={bringBack} testID="unarchive-group" />
          ) : (
            <Button variant="secondary" icon="archive" label="Archive group" onPress={archive} testID="archive-group" />
          )}
          <Text variant="caption" tone="muted" style={styles.caption} testID="archive-note">
            {group.archived
              ? 'It’s under Archived at the bottom of your groups, and out of the totals.'
              : settled
                ? 'Moves it under Archived at the bottom of your groups and out of the totals. Nothing is deleted.'
                : 'There are still payments to settle. Archived, it moves out of your list and totals, and nothing is deleted.'}
          </Text>

          <SectionLabel>Delete</SectionLabel>
          <Button variant="danger" icon="trash" label="Delete group" onPress={() => setConfirming(true)} testID="delete-group" />
        </Scroll>
      </KeyboardAvoidingView>
      <ConfirmDialog
        visible={confirming}
        title={`Delete ${group.name}?`}
        message={`This removes the group, its ${plural(group.expenses.length, 'expense')} and ${plural(group.payments.length, 'payment')} from this device. You’ll have a few seconds to undo it.`}
        confirmLabel="Delete group"
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useLastDefined(useGroup(id));
  if (!group) {
    return (
      <Screen>
        <TopBar leading={{ icon: 'x', label: 'Close', onPress: () => router.replace('/') }} />
        <Text variant="heading" accessibilityRole="header" style={{ textAlign: 'center', marginTop: space(10) }}>
          This group isn’t here
        </Text>
      </Screen>
    );
  }
  return <GroupSettings key={group.id} group={group} />;
}

const styles = StyleSheet.create({
  caption: { marginTop: space(2) },
  people: { gap: space(3) },
  personBlock: { gap: space(1) },
  person: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  leftNote: { marginLeft: 36 + space(3) },
});
