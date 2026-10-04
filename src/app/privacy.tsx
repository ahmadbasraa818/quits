import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { issueUrl, openLink } from '@/components/crash-screen';
import { Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { Text } from '@/components/text';
import { space } from '@/theme';

const UPDATED = '4 October 2026';
const GITHUB_PRIVACY = 'https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement';

const SECTIONS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: 'What Quits keeps',
    paragraphs: [
      'Your groups: their names, the people in them, and every expense and payment. They’re kept on this device: in the app’s own storage on a phone, and in this browser’s storage for this site on the web.',
      'Quits has no account and no server of its own, and it has no analytics, no adverts and no tracking.',
    ],
  },
  {
    heading: 'What leaves your device',
    paragraphs: [
      'Exchange rates. When an expense is in another currency and Quits looks up the rate, it asks frankfurter.dev for the European Central Bank’s rate between the two currencies on that day. The request carries the two currencies and the date, and nothing about your group. Like any request, it comes from your device’s internet address.',
      'Share links, when you send one. The whole group travels inside the link, after the #. Browsers don’t send that part to any server, so the web host never sees it. Anyone who has the link can read the group, so send it only to the people in it.',
      'Backups and exports, where you choose to put them. Quits saves the file and goes no further.',
      'A problem report, if you send one. It opens a new issue on GitHub in your browser, filled in with the version of Quits and the error. You see everything before it’s sent, and it’s sent from your own GitHub account.',
    ],
  },
  {
    heading: 'Where the web version is served from',
    paragraphs: ['GitHub Pages. Like any web host, it receives your internet address and browser details when the page loads. GitHub’s privacy statement covers what it does with them.'],
  },
  {
    heading: 'Deleting your data',
    paragraphs: ['Delete a group from its settings. To remove everything, uninstall the app, or clear this site’s data in your browser.'],
  },
];

export default function PrivacyScreen() {
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Screen>
      <TopBar title="Privacy" leading={{ icon: 'x', label: 'Close', onPress: close }} />
      <Scroll>
        <Text variant="title" accessibilityRole="header">
          Your groups stay yours
        </Text>
        <Text variant="body" tone="muted" style={styles.lede}>
          Quits keeps everything on your device. This is what it keeps, and the few times anything leaves.
        </Text>
        {SECTIONS.map((section) => (
          <View key={section.heading}>
            <SectionLabel>{section.heading}</SectionLabel>
            <View style={styles.paragraphs}>
              {section.paragraphs.map((paragraph) => (
                <Text key={paragraph} variant="body">
                  {paragraph}
                </Text>
              ))}
            </View>
          </View>
        ))}
        <View style={styles.actions}>
          <Button label="GitHub’s privacy statement" icon="arrowRight" variant="secondary" onPress={() => openLink(GITHUB_PRIVACY)} />
          <Button label="Ask a question or report a problem" icon="bug" variant="ghost" onPress={() => openLink(issueUrl())} />
        </View>
        <Text variant="caption" tone="muted" style={styles.updated}>
          Last updated {UPDATED}.
        </Text>
      </Scroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { marginTop: space(2) },
  paragraphs: { gap: space(3) },
  actions: { gap: space(3), marginTop: space(8) },
  updated: { marginTop: space(6) },
});
