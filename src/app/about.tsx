import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon, IconName } from '@/components/icon';
import { Card, Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { useGroups } from '@/store/groups';
import { space, useTheme } from '@/theme';

const SOURCE = 'https://github.com/ahmadbasraa818/quits';

const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'scales',
    title: 'Fair to the penny',
    body: 'Money is kept in whole pence, cents or yen. When a bill won’t divide evenly, the leftover pennies go to the largest remainders, so every split adds up exactly.',
  },
  {
    icon: 'arrowsLeftRight',
    title: 'The fewest payments',
    body: 'Quits looks for the most circles of people whose debts cancel out. A group that splits into k such circles settles in n − k payments, and no fewer. It checks every way for groups of up to 16, in a blink.',
  },
  {
    icon: 'globeHemisphereWest',
    title: 'Any of 33 currencies',
    body: 'Pay in one currency and settle in another. Quits converts at the European Central Bank’s rate for the day, looked up through frankfurter.dev, which is the only time it goes online. You can type your own rate instead. The rate is fixed when you save, and the sums are exact.',
  },
  {
    icon: 'checkCircle',
    title: 'Tested on thousands of groups',
    body: 'Property tests generate random groups and check every settlement against an independent search for the true minimum.',
  },
];

export default function AboutScreen() {
  const theme = useTheme();
  const resetDemo = useGroups((state) => state.resetDemo);
  const showToast = useToast((state) => state.show);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openSource = () => {
    if (Platform.OS === 'web') window.open(SOURCE, '_blank', 'noopener');
    else WebBrowser.openBrowserAsync(SOURCE).catch(() => {});
  };

  return (
    <Screen>
      <TopBar title="About Quits" leading={{ icon: 'x', label: 'Close', onPress: close }} />
      <Scroll>
        <Text variant="title" accessibilityRole="header">
          Split costs, settle fast
        </Text>
        <Text variant="body" tone="muted" style={{ marginTop: space(2) }}>
          Add what everyone paid for on a trip, in a flat or on a night out. Quits keeps a running score and tells you the fewest payments that make everyone square.
        </Text>

        <SectionLabel>How it works</SectionLabel>
        <View style={{ gap: space(3) }}>
          {POINTS.map((point) => (
            <Card key={point.title} style={styles.point}>
              <Icon name={point.icon} size={24} color={theme.ink} />
              <View style={{ flex: 1, gap: space(1) }}>
                <Text variant="bodyStrong">{point.title}</Text>
                <Text variant="body" tone="muted">
                  {point.body}
                </Text>
              </View>
            </Card>
          ))}
        </View>

        <SectionLabel>Made with</SectionLabel>
        <Text variant="body" tone="muted">
          React Native, Expo Router, TypeScript, Reanimated, Zustand and react-native-svg. The same code runs on iOS, Android and the web.
        </Text>

        <View style={styles.actions}>
          <Button label="View the source on GitHub" icon="githubLogo" variant="secondary" onPress={openSource} />
          <Button
            label="Reset the demo data"
            icon="arrowCounterClockwise"
            variant="ghost"
            testID="reset-demo"
            onPress={() => {
              resetDemo();
              showToast('Demo data restored');
              router.replace('/');
            }}
          />
        </View>
      </Scroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  point: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start' },
  actions: { gap: space(3), marginTop: space(8) },
});
