import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { isEmbedded } from '@/lib/install';
import { isDemo, useGroups } from '@/store/groups';
import { useSettings, useSettingsHydrated } from '@/store/settings';
import { radius, space, useTheme } from '@/theme';

import { Button, IconButton } from './button';
import { openGroup } from './group-list';
import { Card } from './layout';
import { Text } from './text';

const STEPS = [
  { title: 'Add what everyone paid', body: 'In any currency, split any way, or typed as a sentence.' },
  { title: 'Quits keeps the score', body: 'Who’s owed and who owes, and where the money went.' },
  { title: 'Settle in the fewest payments', body: 'One plan for the whole group, ticked off as people pay.' },
];

/**
 * For someone new: what Quits does in three steps, with the demo to try them
 * on. It goes once put away, or once the person has a group of their own,
 * and never shows inside another site's page.
 */
export function WelcomeCard() {
  const theme = useTheme();
  const ready = useSettingsHydrated();
  const done = useSettings((state) => state.welcomeDone);
  const finish = useSettings((state) => state.finishWelcome);
  const groups = useGroups((state) => state.groups);
  if (!ready || done || groups.some((group) => !isDemo(group)) || isEmbedded()) return null;
  const hasTrip = groups.some((group) => group.id === 'demo_japan');
  return (
    <Card style={styles.card} testID="welcome-card">
      <View style={styles.top}>
        <Text variant="heading" accessibilityRole="header" style={styles.flex}>
          New to Quits?
        </Text>
        <IconButton icon="x" label="Put the welcome away" onPress={finish} testID="welcome-dismiss" />
      </View>
      {STEPS.map((step, index) => (
        <View key={step.title} style={styles.step}>
          <View style={[styles.number, { backgroundColor: theme.brand }]}>
            <Text variant="label" tone="onBrand">
              {index + 1}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{step.title}</Text>
            <Text variant="body" tone="muted">
              {step.body}
            </Text>
          </View>
        </View>
      ))}
      <View style={styles.actions}>
        {hasTrip ? <Button label="Try the Japan trip" icon="arrowRight" onPress={() => openGroup('demo_japan', false)} testID="welcome-try" /> : null}
        <Button label="Start my own group" icon="plus" variant="secondary" onPress={() => router.push('/new-group')} testID="welcome-start" />
        <Button label="Help" icon="question" variant="ghost" onPress={() => router.push('/help')} testID="welcome-help" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: space(3), marginBottom: space(5) },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  step: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start' },
  number: { width: 26, height: 26, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  actions: { gap: space(2), marginTop: space(2) },
});
