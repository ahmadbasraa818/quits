import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { font, MAX_WIDTH, radius, space, useTheme } from '@/theme';

import { Text } from './text';

type Toast = { id: number; message: string; action?: { label: string; onPress: () => void } };

export const useToast = create<{ toast: Toast | null; show: (message: string, action?: Toast['action']) => void; hide: () => void }>((set) => ({
  toast: null,
  show: (message, action) => set({ toast: { id: Date.now(), message, action } }),
  hide: () => set({ toast: null }),
}));

/** A short message at the bottom of the screen, with an optional Undo. */
export function ToastHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { toast, hide } = useToast();

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(hide, 5000);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: Math.max(insets.bottom, space(4)) + space(16) }]}>
      <Animated.View
        key={toast.id}
        entering={FadeInDown.duration(200)}
        exiting={FadeOutDown.duration(150)}
        accessibilityRole="alert"
        style={[styles.toast, { backgroundColor: theme.ink }]}
      >
        <Text variant="label" style={{ color: theme.background, flex: 1 }}>
          {toast.message}
        </Text>
        {toast.action ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              toast.action?.onPress();
              hide();
            }}
            hitSlop={8}
          >
            <Text variant="label" style={{ color: theme.background, fontFamily: font.bold, textDecorationLine: 'underline' }}>
              {toast.action.label}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space(5) },
  toast: {
    width: '100%',
    maxWidth: MAX_WIDTH - space(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(4),
    borderRadius: radius.md,
    paddingVertical: space(3.5),
    paddingHorizontal: space(4),
  },
});
