import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button, IconButton } from '@/components/button';
import { CurrencyField } from '@/components/currency-picker';
import { Field } from '@/components/field';
import { success } from '@/components/haptics';
import { Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { Text } from '@/components/text';
import { MAX_MEMBERS, namesProblem, tonesFor } from '@/lib/members';
import type { CurrencyCode } from '@/lib/money';
import { useGroups } from '@/store/groups';
import { space } from '@/theme';

export default function NewGroupScreen() {
  const createGroup = useGroups((state) => state.createGroup);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('GBP');
  const [people, setPeople] = useState<string[]>(['', '']);

  const named = people.map((person) => person.trim()).filter(Boolean);
  const tones = tonesFor(people.length);
  const problem =
    name.trim() === '' ? 'Give the group a name.' : named.length === 0 ? 'Add at least one other person.' : namesProblem(named);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen
      footer={
        <Button
          label="Create group"
          icon="check"
          testID="create-group"
          disabled={problem !== null}
          onPress={() => {
            const id = createGroup({ name: name.trim(), currency, memberNames: named });
            success();
            router.replace({ pathname: '/group/[id]', params: { id } });
          }}
        />
      }
    >
      <TopBar title="New group" leading={{ icon: 'x', label: 'Close', onPress: close }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Scroll>
          <SectionLabel>Name</SectionLabel>
          <Field testID="group-name" accessibilityLabel="Group name" value={name} onChangeText={setName} placeholder="Lisbon weekend, Flat 2, Five-a-side…" autoFocus maxLength={40} />

          <SectionLabel>Currency</SectionLabel>
          <CurrencyField value={currency} onChange={setCurrency} />

          <SectionLabel>People</SectionLabel>
          <View style={styles.people}>
            <View style={styles.person}>
              <Avatar member={{ name: 'You', tone: 0 }} size={36} />
              <Text variant="bodyStrong">You</Text>
            </View>
            {people.map((person, index) => (
              <View key={index} style={styles.person}>
                <Avatar member={{ name: person || '?', tone: tones[index] }} size={36} />
                <Field
                  testID={`person-${index}`}
                  accessibilityLabel={`Person ${index + 2}`}
                  value={person}
                  onChangeText={(text) => setPeople((current) => current.map((value, i) => (i === index ? text : value)))}
                  placeholder="Their name"
                  maxLength={24}
                  style={{ flex: 1 }}
                />
                {people.length > 1 ? (
                  <IconButton icon="x" label={`Remove person ${index + 2}`} onPress={() => setPeople((current) => current.filter((_, i) => i !== index))} />
                ) : null}
              </View>
            ))}
            {people.length + 1 < MAX_MEMBERS ? (
              <Button variant="ghost" compact icon="userPlus" label="Add someone" onPress={() => setPeople((current) => [...current, ''])} />
            ) : null}
          </View>
          {problem && (name !== '' || people.some(Boolean)) ? (
            <Text variant="label" tone="negative" style={{ marginTop: space(3) }}>
              {problem}
            </Text>
          ) : null}
        </Scroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  people: { gap: space(3) },
  person: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
});
