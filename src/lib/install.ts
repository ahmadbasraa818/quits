import { Platform } from 'react-native';
import { create } from 'zustand';

/** The browser's offer to install the web app, held until someone asks for it. */
type InstallOffer = { prompt: () => Promise<void> };

export const useInstall = create<{ offer: InstallOffer | null; installed: boolean }>(() => ({ offer: null, installed: false }));

/**
 * Listens for the browser offering to install Quits. The offer can come the
 * moment the page loads, before any screen asks for it, so this starts with
 * the app. Elsewhere than the web, it does nothing.
 */
export function listenForInstall() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  useInstall.setState({ installed: Boolean(standalone) });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    useInstall.setState({ offer: event as unknown as InstallOffer });
  });
  window.addEventListener('appinstalled', () => useInstall.setState({ installed: true, offer: null }));
}

/** Inside another site's page, such as a portfolio showing the demo: no notes, welcomes or workers there. */
export function isEmbedded(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && window.top !== window.self;
}

/** On an iPhone or iPad, where Safari installs from its share menu instead of offering. */
export function isAppleMobile(): boolean {
  return Platform.OS === 'web' && typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Registers the service worker that keeps a copy of the app, so it opens
 * without a connection and installs like an app. Only in the built web app
 * (the worker is made by the build), and not inside another site's page,
 * such as a portfolio embedding the demo.
 */
export function keepForOffline() {
  if (Platform.OS !== 'web' || __DEV__ || typeof window === 'undefined' || !('serviceWorker' in navigator) || isEmbedded()) return;
  const register = () => navigator.serviceWorker.register('/quits/sw.js', { scope: '/quits/' }).catch(() => {});
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}
