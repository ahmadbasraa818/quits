import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastHost } from '@/components/toast';
import { useGroups } from '@/store/groups';
import { useTheme } from '@/theme';
import { fontFiles } from '@/theme/fonts';

SplashScreen.preventAutoHideAsync().catch(() => {});

// A modal opened from a link still has the groups list behind it.
export const unstable_settings = { anchor: 'index' };

export default function RootLayout() {
  const theme = useTheme();
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const hydrated = useGroups((state) => state.hydrated);
  const ready = (fontsLoaded || fontError !== null) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  const navigationTheme = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
      <ThemeProvider value={{ ...navigationTheme, colors: { ...navigationTheme.colors, background: theme.background, card: theme.background, primary: theme.brand, text: theme.ink, border: theme.line } }}>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="group/[id]/index" />
          <Stack.Screen name="group/[id]/expense" options={{ presentation: 'modal' }} />
          <Stack.Screen name="group/[id]/settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="new-group" options={{ presentation: 'modal' }} />
          <Stack.Screen name="about" options={{ presentation: 'modal' }} />
        </Stack>
        <ToastHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
