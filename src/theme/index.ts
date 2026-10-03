import { useColorScheme } from 'react-native';

/**
 * Quits is set on warm paper with near-black ink and one orange, the same
 * family as thecodingexplorer.com. Text on orange is always ink: white on
 * orange fails contrast. Money owed to you is green, money you owe is red.
 */
export type Theme = {
  scheme: 'light' | 'dark';
  background: string;
  card: string;
  sunken: string;
  line: string;
  ink: string;
  inkMuted: string;
  brand: string;
  onBrand: string;
  positive: string;
  negative: string;
  /** Avatar backgrounds; text on them is ink. */
  tones: string[];
};

const light: Theme = {
  scheme: 'light',
  background: '#F5F3EE',
  card: '#FFFFFF',
  sunken: '#ECE9E2',
  line: '#E0DCD2',
  ink: '#16171A',
  inkMuted: '#5E6168',
  brand: '#FF5A1F',
  onBrand: '#16171A',
  positive: '#0B7A55',
  negative: '#C2352B',
  tones: ['#FFD9C8', '#D7E6FF', '#D3F1E1', '#F1DCF8', '#FFEFB8', '#DCE2EE', '#F9D5DF', '#D2EDF1'],
};

const dark: Theme = {
  scheme: 'dark',
  background: '#0F1012',
  card: '#18191C',
  sunken: '#222428',
  line: '#2D3035',
  ink: '#F4F2ED',
  inkMuted: '#A6A9AF',
  brand: '#FF6A33',
  onBrand: '#16171A',
  positive: '#43D296',
  negative: '#FF7C70',
  tones: ['#5C2F1E', '#23395E', '#1E4A36', '#4A2A58', '#5B4A15', '#2F3647', '#5B2538', '#1F4A51'],
};

export const themes: Record<'light' | 'dark', Theme> = { light, dark };

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const font = {
  regular: 'Archivo_400Regular',
  medium: 'Archivo_500Medium',
  semibold: 'Archivo_600SemiBold',
  bold: 'Archivo_700Bold',
  heavy: 'Archivo_800ExtraBold',
} as const;

/** Spacing on a 4-point scale. */
export const space = (steps: number) => steps * 4;

export const radius = { sm: 10, md: 14, lg: 22, pill: 999 } as const;

/** The widest the app gets on a large screen; it reads like a phone app everywhere. */
export const MAX_WIDTH = 560;
