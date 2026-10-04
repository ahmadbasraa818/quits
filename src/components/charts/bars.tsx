import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { radius, space, useTheme } from '@/theme';

import { Text } from '../text';

export type BarDatum = { key: string; value: number; label: string; detail: string };

const HEIGHT = 128;

function Bar({ fraction, color, order, height }: { fraction: number; color: string; order: number; height: number }) {
  const reduceMotion = useReducedMotion();
  const grown = useSharedValue(reduceMotion ? fraction : 0);
  useEffect(() => {
    grown.set(reduceMotion ? fraction : withDelay(Math.min(order, 30) * 18, withTiming(fraction, { duration: 480, easing: Easing.out(Easing.cubic) })));
  }, [fraction, reduceMotion, order, grown]);
  const style = useAnimatedStyle(() => ({ height: Math.max(grown.get() > 0 ? 2 : 0, grown.get() * height) }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

/**
 * Columns that grow in, one per bucket. Tapping one picks it out and says
 * what it was; every column is also a button for screen readers, with the
 * same words.
 */
export function Bars({ data, selected, onSelect }: { data: BarDatum[]; selected: string | null; onSelect: (key: string | null) => void }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const largest = Math.max(1, ...data.map((datum) => datum.value));
  // Label every bar when there's room, otherwise every few, always the first and last.
  const every = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(width / 44))));
  return (
    <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
      <View style={[styles.plot, { borderBottomColor: theme.line }]}>
        {data.map((datum, index) => {
          const isSelected = selected === datum.key;
          return (
            <Pressable
              key={datum.key}
              testID={`bar-${datum.key}`}
              accessibilityRole="button"
              accessibilityLabel={datum.detail}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(isSelected ? null : datum.key)}
              style={styles.column}
            >
              <Bar fraction={datum.value / largest} color={isSelected || selected === null ? theme.brand : theme.sunken} order={index} height={HEIGHT} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.labels} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {data.map((datum, index) => (
          <Text key={datum.key} variant="caption" tone="muted" numberOfLines={1} style={styles.label}>
            {index % every === 0 || (index === data.length - 1 && index % every >= every / 2) ? datum.label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', height: HEIGHT, gap: 3, borderBottomWidth: 1 },
  column: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: radius.sm / 2, borderTopRightRadius: radius.sm / 2 },
  labels: { flexDirection: 'row', gap: 3, marginTop: space(1.5) },
  label: { flex: 1, textAlign: 'center', fontSize: 11 },
});
