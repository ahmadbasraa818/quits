import { ReactNode, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, useTheme } from '@/theme';

import { IconButton } from './button';
import { Text } from './text';

/** From this width a sheet opens as a dialog in the middle of the screen. */
const DIALOG_WIDTH = 720;
const DURATION = 220;

/**
 * A panel over the screen, for a short task: picking a date or a currency,
 * confirming a delete. It rises from the bottom on a phone and appears in the
 * middle on a wide screen. Escape, the back button and the backdrop close it.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  tall = false,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Take most of the height, for long lists. */
  tall?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const dialog = width >= DIALOG_WIDTH;
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  // Mount as soon as it's asked for; unmount only once the exit animation is over.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      progress.set(reduceMotion ? 1 : withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) }));
      return undefined;
    }
    progress.set(reduceMotion ? 0 : withTiming(0, { duration: DURATION * 0.8, easing: Easing.in(Easing.cubic) }));
    const timer = setTimeout(() => setMounted(false), reduceMotion ? 0 : DURATION * 0.8);
    return () => clearTimeout(timer);
  }, [visible, reduceMotion, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const panelStyle = useAnimatedStyle(() =>
    dialog
      ? { opacity: progress.get(), transform: [{ scale: 0.96 + progress.get() * 0.04 }] }
      : { transform: [{ translateY: (1 - progress.get()) * height }] }
  );

  const webLabel = Platform.OS === 'web' ? ({ 'aria-label': title } as object) : null;
  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose} statusBarTranslucent {...webLabel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.fill, dialog ? styles.centre : styles.bottom]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, backdropStyle]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View
          testID={testID}
          style={[
            styles.panel,
            { backgroundColor: theme.background },
            dialog ? styles.dialog : [styles.drawer, { paddingBottom: footer ? 0 : Math.max(insets.bottom, space(4)) }],
            { maxHeight: dialog ? Math.min(height - space(16), 720) : height - insets.top - space(6) },
            tall && { height: dialog ? Math.min(height - space(16), 640) : height - insets.top - space(6) },
            panelStyle,
          ]}
        >
          {dialog ? null : <View style={[styles.grabber, { backgroundColor: theme.line }]} />}
          <View style={styles.header}>
            <Text variant="heading" accessibilityRole="header" style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <IconButton icon="x" label="Close" onPress={onClose} />
          </View>
          <View style={styles.body}>{children}</View>
          {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space(4)) }]}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { alignItems: 'center', justifyContent: 'center', padding: space(8) },
  bottom: { justifyContent: 'flex-end' },
  panel: { overflow: 'hidden' },
  drawer: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, width: '100%' },
  dialog: { borderRadius: radius.lg, width: '100%', maxWidth: 480 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: radius.pill, marginTop: space(2) },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: space(5), paddingRight: space(2), paddingTop: space(2), minHeight: 56 },
  title: { flex: 1 },
  body: { flexShrink: 1, flexGrow: 1 },
  footer: { paddingHorizontal: space(5), paddingTop: space(3) },
});
