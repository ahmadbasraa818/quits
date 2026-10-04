import { ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type DonutSegment = { key: string; value: number; color: string };

/**
 * A ring of proportions with something in the middle. Each segment is a dash
 * on the circle, placed by its offset; a ring in the background colour then
 * slides off clockwise, so the segments appear as if drawn round.
 */
export function Donut({
  segments,
  size = 168,
  thickness = 22,
  background,
  children,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  /** What's behind the ring, for the cover that reveals it. */
  background: string;
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const radius = (size - thickness) / 2;
  const centre = size / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const revealed = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    revealed.set(reduceMotion ? 1 : withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
  }, [reduceMotion, revealed]);
  // The cover's dash starts where the reveal has got to and runs to the end of the circle.
  const coverProps = useAnimatedProps(() => ({ strokeDashoffset: -revealed.get() * circumference }));

  let start = 0;
  return (
    <View style={{ width: size, height: size }} accessible={false} aria-hidden>
      {/* A quarter turn back, so the first segment starts at twelve o'clock. */}
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {total > 0
          ? segments.map((segment) => {
              const length = (segment.value / total) * circumference;
              const arc = (
                <Circle
                  key={segment.key}
                  cx={centre}
                  cy={centre}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={thickness}
                  // A sliver of a gap between segments, unless it's the only one.
                  strokeDasharray={[Math.max(0.5, length - (segments.length > 1 ? 1.5 : 0)), circumference]}
                  strokeDashoffset={-start}
                />
              );
              start += length;
              return arc;
            })
          : null}
        <AnimatedCircle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke={background}
          strokeWidth={thickness + 2}
          strokeDasharray={[circumference, circumference]}
          animatedProps={coverProps}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.middle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  middle: { alignItems: 'center', justifyContent: 'center' },
});
