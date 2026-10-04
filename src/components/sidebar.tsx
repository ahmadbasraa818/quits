import { router, usePathname } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGroups } from '@/store/groups';
import { font, space, useTheme } from '@/theme';

import { Button, IconButton } from './button';
import { GroupCard, Overview } from './group-list';
import { SectionLabel } from './layout';
import { Text } from './text';

/** The groups, beside whatever is open, on a wide screen. */
export function Sidebar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const groups = useGroups((state) => state.groups);
  const selected = /^\/group\/([^/]+)/.exec(usePathname())?.[1];
  return (
    <View role="navigation" aria-label="Your groups" style={[styles.sidebar, { borderRightColor: theme.line, paddingTop: insets.top }]} testID="sidebar">
      <View style={styles.top}>
        <Text style={[styles.brand, { color: theme.ink }]}>Quits</Text>
        <IconButton icon="info" label="About Quits" onPress={() => router.push('/about')} />
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        <Overview groups={groups} />
        <SectionLabel>Groups</SectionLabel>
        <View style={{ gap: space(3) }}>
          {groups.map((group, index) => (
            <GroupCard key={group.id} group={group} index={index} selected={group.id === selected} split />
          ))}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space(4)) }]}>
        <Button label="New group" icon="plus" onPress={() => router.push('/new-group')} testID="new-group-sidebar" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 360, borderRightWidth: StyleSheet.hairlineWidth },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: space(5), paddingRight: space(2), minHeight: 64 },
  brand: { fontFamily: font.heavy, fontSize: 28, letterSpacing: -0.8 },
  list: { paddingHorizontal: space(5), paddingBottom: space(6) },
  footer: { paddingHorizontal: space(5), paddingTop: space(3) },
});
