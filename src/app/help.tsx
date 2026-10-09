import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { issueUrl, openLink } from '@/components/crash-screen';
import { Field } from '@/components/field';
import { Icon } from '@/components/icon';
import { Card, Screen, Scroll, SectionLabel, TopBar } from '@/components/layout';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { HELP, type HelpEntry, helpEntry, hrefFor, searchHelp, SHORTCUTS, TOPICS } from '@/lib/help';
import type { Group } from '@/lib/types';
import { useGroups } from '@/store/groups';
import { radius, space, useTheme } from '@/theme';

function Entry({ entry, open, onToggle, groups }: { entry: HelpEntry; open: boolean; onToggle: () => void; groups: Group[] }) {
  const theme = useTheme();
  const href = entry.show ? hrefFor(entry.show.target, groups) : null;
  return (
    <View testID={`entry-${entry.id}`}>
      <PressableScale accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open} onPress={onToggle} style={styles.question}>
        <Text variant="bodyStrong" style={styles.flex}>
          {entry.question}
        </Text>
        <View style={open ? styles.turned : undefined}>
          <Icon name="caretDown" size={18} color={theme.inkMuted} />
        </View>
      </PressableScale>
      {open ? (
        <View style={styles.answer}>
          {entry.answer.map((paragraph) => (
            <Text key={paragraph} variant="body" tone="muted">
              {paragraph}
            </Text>
          ))}
          {href && entry.show ? (
            <View style={styles.show}>
              <Button compact variant="secondary" label={entry.show.label} icon="arrowRight" onPress={() => router.push(href)} testID={`show-${entry.id}`} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Entries in a panel, with a hairline between each. */
function Panel({ entries, open, toggle, groups }: { entries: readonly HelpEntry[]; open: Set<string>; toggle: (id: string) => void; groups: Group[] }) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.line }]}>
      {entries.map((entry, index) => (
        <View key={entry.id} style={index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line } : undefined}>
          <Entry entry={entry} open={open.has(entry.id)} onToggle={() => toggle(entry.id)} groups={groups} />
        </View>
      ))}
    </View>
  );
}

export default function HelpScreen() {
  const theme = useTheme();
  // Opened from a “?”: that answer first, then everything else.
  const { entry: askedId } = useLocalSearchParams<{ entry?: string }>();
  const asked = askedId ? helpEntry(askedId) : undefined;
  const groups = useGroups((state) => state.groups);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const results = query.trim() ? searchHelp(query) : null;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen>
      <TopBar title="Help" leading={{ icon: 'x', label: 'Close', onPress: close }} />
      <Scroll keyboardShouldPersistTaps="handled">
        {asked ? (
          <Card style={styles.asked} testID="asked">
            <Text variant="heading" accessibilityRole="header">
              {asked.question}
            </Text>
            {asked.answer.map((paragraph) => (
              <Text key={paragraph} variant="body">
                {paragraph}
              </Text>
            ))}
          </Card>
        ) : (
          <View style={styles.intro}>
            <Text variant="title" accessibilityRole="header">
              Questions and answers
            </Text>
            <Text variant="body" tone="muted">
              Answers about adding expenses, settling up, sharing and your data.
            </Text>
          </View>
        )}

        <Field
          testID="help-search"
          accessibilityLabel="Search help"
          placeholder="Search help"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
          leading={<Icon name="magnifyingGlass" size={18} color={theme.inkMuted} />}
        />

        {results ? (
          <View style={styles.results} accessibilityLiveRegion="polite">
            {results.length === 0 ? (
              <Text variant="body" tone="muted" testID="help-none">
                No answers match “{query.trim()}”. Try fewer words, or report a problem below.
              </Text>
            ) : (
              <Panel entries={results} open={open} toggle={toggle} groups={groups} />
            )}
          </View>
        ) : (
          TOPICS.map((topic) => (
            <View key={topic.id}>
              <SectionLabel>{topic.title}</SectionLabel>
              <Panel entries={HELP.filter((entry) => entry.topic === topic.id)} open={open} toggle={toggle} groups={groups} />
            </View>
          ))
        )}

        {Platform.OS === 'web' ? (
          <View>
            <SectionLabel>Keyboard shortcuts</SectionLabel>
            <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.line }]} testID="shortcuts">
              {SHORTCUTS.map((shortcut, index) => (
                <View key={shortcut.keys} style={[styles.shortcut, index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line } : null]}>
                  <View style={[styles.key, { backgroundColor: theme.sunken, borderColor: theme.line }]}>
                    <Text variant="label">{shortcut.keys}</Text>
                  </View>
                  <Text variant="body" style={styles.flex}>
                    {shortcut.does}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <SectionLabel>Still stuck?</SectionLabel>
        <Text variant="body" tone="muted">
          Report a problem and it goes to Quits on GitHub, with the version filled in and nothing from your groups.
        </Text>
        <View style={styles.report}>
          <Button label="Report a problem" icon="bug" variant="secondary" onPress={() => openLink(issueUrl())} testID="help-report" />
        </View>
      </Scroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { gap: space(2), marginBottom: space(5) },
  asked: { gap: space(3), marginBottom: space(5) },
  results: { marginTop: space(4) },
  panel: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  question: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3.5), minHeight: 52 },
  turned: { transform: [{ rotate: '180deg' }] },
  answer: { gap: space(3), paddingHorizontal: space(4), paddingBottom: space(4) },
  show: { alignItems: 'flex-start' },
  shortcut: { flexDirection: 'row', alignItems: 'center', gap: space(4), paddingHorizontal: space(4), paddingVertical: space(3) },
  key: { minWidth: 44, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: space(2), paddingVertical: space(1) },
  report: { alignItems: 'flex-start', marginTop: space(3) },
});
