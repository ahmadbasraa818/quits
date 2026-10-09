import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/button';
import { ArchivedGroups, GroupCard, openGroup, Overview, splitArchived, useSplitView } from '@/components/group-list';
import { Icon, IconName } from '@/components/icon';
import { Notices } from '@/components/notices';
import { useShortcuts } from '@/components/shortcuts';
import { WelcomeCard } from '@/components/welcome-card';
import { Card, Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { Text } from '@/components/text';
import { useGroups } from '@/store/groups';
import { radius, space, useTheme } from '@/theme';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'arrowsLeftRight', title: 'The fewest payments', body: 'The Japan trip settles in 4 payments instead of the 10 it would take pair by pair, and you can watch it happen.' },
  { icon: 'globeHemisphereWest', title: 'Any currency, to the penny', body: 'Pay in yen, settle in pounds, at the European Central Bank’s rate for the day. The sums are exact.' },
  { icon: 'magicWand', title: 'Write it as you’d say it', body: '“Ramen ¥4,800, Aiko paid, split with Ben and me” fills in the whole expense.' },
];

/** Beside the sidebar on a wide screen, where the list would be: what Quits does, and where to start. */
function Welcome() {
  const theme = useTheme();
  const hasDemo = useGroups((state) => state.groups.some((group) => group.id === 'demo_japan'));
  return (
    <Screen>
      <Scroll contentContainerStyle={styles.welcome}>
        <Text variant="display" accessibilityRole="header">
          Quits
        </Text>
        <Text variant="body" tone="muted" style={styles.tagline}>
          Split costs with friends. Settle up in the fewest payments.
        </Text>
        <Notices />
        <View style={{ gap: space(3) }}>
          {FEATURES.map((feature) => (
            <Card key={feature.title} style={styles.feature}>
              <View style={[styles.featureIcon, { backgroundColor: theme.sunken }]}>
                <Icon name={feature.icon} size={22} color={theme.ink} />
              </View>
              <View style={{ flex: 1, gap: space(1) }}>
                <Text variant="bodyStrong">{feature.title}</Text>
                <Text variant="body" tone="muted">
                  {feature.body}
                </Text>
              </View>
            </Card>
          ))}
        </View>
        <Text variant="body" tone="muted" style={styles.start}>
          Open a group from the list, or start one of your own.
        </Text>
        <View style={styles.actions}>
          {hasDemo ? <Button label="Open the Japan trip" icon="arrowRight" onPress={() => openGroup('demo_japan', true)} testID="open-demo" /> : null}
          <Button label="New group" icon="plus" variant="secondary" onPress={() => router.push('/new-group')} testID="new-group" />
          <Button label="Help" icon="question" variant="ghost" onPress={() => router.push('/help')} testID="open-help" />
        </View>
      </Scroll>
    </Screen>
  );
}

export default function GroupsScreen() {
  const { active, archived } = splitArchived(useGroups((state) => state.groups));
  const split = useSplitView();
  // On a computer, N starts a group from here.
  const newGroup = () => router.push('/new-group');
  useShortcuts({ n: newGroup, N: newGroup });
  if (split) return <Welcome />;
  return (
    <Screen footer={<Button label="New group" icon="plus" onPress={() => router.push('/new-group')} testID="new-group" />}>
      <TopBar
        trailing={
          <>
            <IconButton icon="question" label="Help" testID="open-help" onPress={() => router.push('/help')} />
            <IconButton icon="info" label="About Quits" onPress={() => router.push('/about')} />
          </>
        }
      />
      <Scroll>
        <Text variant="display" accessibilityRole="header">
          Quits
        </Text>
        <Text variant="body" tone="muted" style={styles.tagline}>
          Split costs with friends. Settle up in the fewest payments.
        </Text>
        <Notices />
        <WelcomeCard />
        <Overview groups={active} />
        <SectionLabel>Groups</SectionLabel>
        <View style={styles.list}>
          {active.length === 0 ? (
            <Text variant="body" tone="muted">
              {archived.length > 0 ? 'Every group is archived. Start a new one for a trip, a flat or a night out.' : 'No groups yet. Start one for a trip, a flat or a night out.'}
            </Text>
          ) : (
            active.map((group, index) => <GroupCard key={group.id} group={group} index={index} />)
          )}
        </View>
        <ArchivedGroups groups={archived} />
      </Scroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagline: { marginTop: space(1), marginBottom: space(5) },
  list: { gap: space(3) },
  welcome: { flexGrow: 1, justifyContent: 'center', paddingVertical: space(10) },
  feature: { flexDirection: 'row', gap: space(4), alignItems: 'flex-start' },
  featureIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  start: { marginTop: space(8) },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3), marginTop: space(4) },
});
