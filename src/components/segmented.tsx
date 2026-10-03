import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';

import { radius, space, useTheme } from '@/theme';

import { Text } from './text';

/** A row of mutually exclusive options with a sliding marker under the chosen one. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const segment = width / options.length;
  const thumbStyle = useAnimatedStyle(() => ({
    width: segment - 4,
    transform: [{ translateX: reduceMotion ? index * segment : withTiming(index * segment, { duration: 220 }) }],
  }));

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: theme.sunken }]}
    >
      {width > 0 ? <Animated.View style={[styles.thumb, { backgroundColor: theme.card, borderColor: theme.line }, thumbStyle]} /> : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            aria-selected={selected}
            onPress={() => onChange(option.value)}
            style={styles.option}
          >
            <Text variant="label" tone={selected ? 'ink' : 'muted'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.sm + 2, padding: 2, minHeight: 44 },
  thumb: { position: 'absolute', top: 2, bottom: 2, left: 2, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(2) },
});
