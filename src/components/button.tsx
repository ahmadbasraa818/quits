import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Icon, IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  busy = false,
  compact = false,
  iconOnly = false,
  accessibilityHint,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  compact?: boolean;
  /** Just the icon, in a square; the label is still read out. */
  iconOnly?: boolean;
  accessibilityHint?: string;
  testID?: string;
}) {
  const theme = useTheme();
  const background = { primary: theme.brand, secondary: theme.sunken, ghost: 'transparent', danger: 'transparent', destructive: theme.negative }[variant];
  const foreground = { primary: theme.onBrand, secondary: theme.ink, ghost: theme.ink, danger: theme.negative, destructive: theme.onNegative }[variant];
  return (
    <PressableScale
      haptic
      testID={testID}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      aria-disabled={disabled || busy}
      aria-busy={busy}
      style={[
        styles.base,
        compact && styles.compact,
        iconOnly && styles.iconOnly,
        { backgroundColor: background, opacity: disabled ? 0.45 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: theme.line },
      ]}
    >
      <View style={styles.row}>
        {busy ? <ActivityIndicator color={foreground} /> : icon ? <Icon name={icon} size={compact ? 18 : iconOnly ? 22 : 20} color={foreground} /> : null}
        {iconOnly ? null : (
          <Text variant={compact ? 'label' : 'bodyStrong'} style={{ color: foreground }} numberOfLines={1}>
            {label}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tone = 'plain',
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'plain' | 'filled';
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      haptic
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={[styles.iconButton, { backgroundColor: tone === 'filled' ? theme.sunken : 'transparent' }]}
    >
      <Icon name={icon} size={22} color={theme.ink} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space(5),
    justifyContent: 'center',
    alignItems: 'center',
  },
  compact: { minHeight: 40, paddingHorizontal: space(4), borderRadius: radius.sm },
  iconOnly: { width: 52, paddingHorizontal: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  iconButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
