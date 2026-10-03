import { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

/** A selectable pill. Chosen chips fill with the brand colour, with ink text. */
export function Chip({
  label,
  selected,
  onPress,
  leading,
  accessibilityRole = 'radio',
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  leading?: ReactNode;
  accessibilityRole?: 'radio' | 'checkbox';
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      haptic
      testID={testID}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      aria-checked={selected}
      accessibilityLabel={label}
      style={[
        styles.chip,
        { backgroundColor: selected ? theme.brand : theme.card, borderColor: selected ? theme.brand : theme.line },
      ]}
    >
      {leading}
      <Text variant="label" style={{ color: selected ? theme.onBrand : theme.ink }}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1.5),
    minHeight: 40,
    paddingHorizontal: space(3.5),
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
