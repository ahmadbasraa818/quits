import { Platform, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A pressable that dips slightly while held, with a light tap of haptics on phones. */
export function PressableScale({
  style,
  haptic = false,
  onPress,
  ...props
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; haptic?: boolean }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...props}
      onPress={(event) => {
        if (haptic && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        onPress?.(event);
      }}
      onPressIn={(event) => {
        if (!reduceMotion) scale.set(withTiming(0.96, { duration: 90 }));
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, { duration: 160 }));
        props.onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
}
