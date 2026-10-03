import { ReactNode } from 'react';
import { Platform, ScrollView, ScrollViewProps, StyleSheet, View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_WIDTH, radius, space, useTheme } from '@/theme';

import { IconButton } from './button';
import { IconName } from './icon';
import { Text } from './text';

/** The page: theme background, safe areas, and a phone-width column on big screens. */
export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.column, { paddingTop: insets.top }]}>
        {children}
        {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space(4)) }]}>{footer}</View> : null}
      </View>
    </View>
  );
}

export function Scroll({ children, contentContainerStyle, ...props }: ScrollViewProps & { children: ReactNode }) {
  return (
    <ScrollView
      {...props}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.scroll, contentContainerStyle]}
      showsVerticalScrollIndicator={Platform.OS === 'web'}
    >
      {children}
    </ScrollView>
  );
}

/** A bar with a leading action, a title, and optional actions at the end. */
export function TopBar({
  title,
  leading,
  trailing,
}: {
  title?: string;
  leading?: { icon: IconName; label: string; onPress: () => void };
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarSide}>{leading ? <IconButton icon={leading.icon} label={leading.label} onPress={leading.onPress} /> : null}</View>
      {title ? (
        <Text variant="heading" numberOfLines={1} accessibilityRole="header" style={styles.topBarTitle}>
          {title}
        </Text>
      ) : (
        <View style={styles.topBarTitle} />
      )}
      <View style={[styles.topBarSide, styles.topBarTrailing]}>{trailing}</View>
    </View>
  );
}

export function Card({ children, style, ...props }: ViewProps & { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View {...props} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }, style]}>
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="caption" tone="muted" accessibilityRole="header" style={styles.sectionLabel}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: MAX_WIDTH },
  footer: { paddingHorizontal: space(5), paddingTop: space(3) },
  scroll: { paddingHorizontal: space(5), paddingBottom: space(10) },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space(2), minHeight: 56 },
  topBarSide: { width: 96, flexDirection: 'row' },
  topBarTrailing: { justifyContent: 'flex-end', paddingRight: space(2) },
  topBarTitle: { flex: 1, textAlign: 'center' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space(4) },
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space(6), marginBottom: space(2) },
});
