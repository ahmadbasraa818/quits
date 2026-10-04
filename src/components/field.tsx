import { forwardRef, ReactNode, useState } from 'react';
import { Platform, StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { font, radius, space, useTheme } from '@/theme';

/** Room for an icon at the start of a field. */
const LEADING = 44;

/**
 * A text field. Focus shows as a 2px brand-coloured border, drawn by the app
 * rather than the browser, so it looks the same everywhere and stays visible.
 * A `leading` icon sits inside it, before the text.
 */
export const Field = forwardRef<TextInput, TextInputProps & { bare?: boolean; leading?: ReactNode }>(function Field(
  { style, bare = false, leading, onFocus, onBlur, ...props },
  ref
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  // The thicker focus border would push the text; the padding gives that back.
  const inset = focused ? 1.5 : 0;
  const input = (
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
              paddingLeft: (leading ? LEADING : space(4)) - inset,
              paddingRight: space(4) - inset,
            },
        { color: theme.ink },
        Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
        style,
      ]}
    />
  );
  if (!leading) return input;
  return (
    <View>
      {input}
      <View style={styles.leading} pointerEvents="none">
        {leading}
      </View>
    </View>
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
  bare: { borderWidth: 0, backgroundColor: 'transparent', paddingLeft: 0, paddingRight: 0 },
  leading: { position: 'absolute', left: space(4), top: 0, bottom: 0, justifyContent: 'center' },
});
