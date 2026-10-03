import { StyleSheet, Text as NativeText, TextProps } from 'react-native';

import { font, Theme, useTheme } from '@/theme';

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'label' | 'caption';
export type TextTone = 'ink' | 'muted' | 'positive' | 'negative' | 'brand' | 'onBrand';

const toneColor = (theme: Theme, tone: TextTone) =>
  ({ ink: theme.ink, muted: theme.inkMuted, positive: theme.positive, negative: theme.negative, brand: theme.brand, onBrand: theme.onBrand })[tone];

export function Text({ variant = 'body', tone = 'ink', style, ...props }: TextProps & { variant?: TextVariant; tone?: TextTone }) {
  const theme = useTheme();
  return <NativeText {...props} style={[styles[variant], { color: toneColor(theme, tone) }, style]} />;
}

const styles = StyleSheet.create({
  display: { fontFamily: font.heavy, fontSize: 40, lineHeight: 44, letterSpacing: -1.4 },
  title: { fontFamily: font.bold, fontSize: 28, lineHeight: 33, letterSpacing: -0.7 },
  heading: { fontFamily: font.semibold, fontSize: 18, lineHeight: 23, letterSpacing: -0.2 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: font.semibold, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: font.medium, fontSize: 13, lineHeight: 17 },
});
