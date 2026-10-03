import { forwardRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, TextInputProps } from 'react-native';

import { font, radius, space, useTheme } from '@/theme';

/**
 * A text field. Focus shows as a 2px brand-coloured border, drawn by the app
 * rather than the browser, so it looks the same everywhere and stays visible.
 */
export const Field = forwardRef<TextInput, TextInputProps & { bare?: boolean }>(function Field({ style, bare = false, onFocus, onBlur, ...props }, ref) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.inkMuted}
      selectionColor={theme.brand}
      {...props}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.field,
        bare
          ? styles.bare
          : {
              backgroundColor: theme.card,
              borderColor: focused ? theme.brand : theme.line,
              borderWidth: focused ? 2 : StyleSheet.hairlineWidth,
              paddingHorizontal: focused ? space(4) - 1.5 : space(4),
            },
        { color: theme.ink },
        Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
        style,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  field: {
    fontFamily: font.regular,
    fontSize: 17,
    minHeight: 52,
    borderRadius: radius.md,
    paddingVertical: space(3),
  },
  bare: { borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0 },
});
