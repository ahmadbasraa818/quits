import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, type ErrorBoundaryProps, router, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CrashScreen } from '@/components/crash-screen';
import { useSplitView } from '@/components/group-list';
import { useGlobalShortcuts } from '@/components/shortcuts';
import { RELEASES, WhatsNewOnUpdate } from '@/components/whats-new';
import { Sidebar } from '@/components/sidebar';
import { ToastHost } from '@/components/toast';
import { keepForOffline, listenForInstall } from '@/lib/install';
import { hadSavedGroups, useHydrated } from '@/store/groups';
import { loadSetAside } from '@/store/recovery';
import { settleFirstRun, useSettingsHydrated } from '@/store/settings';
import { useTheme } from '@/theme';
import { fontFiles } from '@/theme/fonts';

SplashScreen.preventAutoHideAsync().catch(() => {});
listenForInstall();
keepForOffline();
loadSetAside();

// A modal opened from a link still has the groups list behind it.
export const unstable_settings = { anchor: 'index' };

/** If any screen throws, a way out instead of a blank page; the groups are untouched. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} retry={retry} />;
}

export default function RootLayout() {
  const theme = useTheme();
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const hydrated = useHydrated();
  const settingsLoaded = useSettingsHydrated();
  const split = useSplitView();
  const pathname = usePathname();
  const ready = (fontsLoaded || fontError !== null) && hydrated && settingsLoaded;
  // On a computer, ? opens help from anywhere.
  useGlobalShortcuts({ '?': () => pathname !== '/help' && router.push('/help') });

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    // A new person gets the welcome; someone back after an update gets what's new.
    settleFirstRun(hadSavedGroups(), RELEASES[0].version);
  }, [ready]);

  if (!ready) return null;

  const navigationTheme = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
      <ThemeProvider value={{ ...navigationTheme, colors: { ...navigationTheme.colors, background: theme.background, card: theme.background, primary: theme.brand, text: theme.ink, border: theme.line } }}>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        {/* On a wide screen the groups stay in a sidebar, beside whatever is open. */}
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {split ? <Sidebar /> : null}
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="group/[id]/index" />
              <Stack.Screen name="group/[id]/expense" options={{ presentation: 'modal' }} />
              <Stack.Screen name="group/[id]/settings" options={{ presentation: 'modal' }} />
              <Stack.Screen name="new-group" options={{ presentation: 'modal' }} />
              <Stack.Screen name="about" options={{ presentation: 'modal' }} />
              <Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
              <Stack.Screen name="help" options={{ presentation: 'modal' }} />
            </Stack>
          </View>
        </View>
        <ToastHost />
        <WhatsNewOnUpdate />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
