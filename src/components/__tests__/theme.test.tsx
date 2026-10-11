import { act, render, renderHook, screen, userEvent } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import AboutScreen from '@/app/about';
import { useSettings } from '@/store/settings';
import { themes, useTheme } from '@/theme';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false, canDismiss: () => false, dismissAll: jest.fn() },
}));
// The device's own setting, which each test sets.
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: jest.fn() }));

const deviceIs = (scheme: 'light' | 'dark') => jest.mocked(useColorScheme).mockReturnValue(scheme);

beforeEach(async () => {
  deviceIs('light');
  await act(async () => useSettings.setState({ theme: 'system' }));
});

describe('the theme', () => {
  it('matches the device until one is chosen', async () => {
    deviceIs('dark');
    const { result } = await renderHook(() => useTheme());
    expect(result.current).toBe(themes.dark);
    await act(async () => useSettings.getState().setTheme('light'));
    expect(result.current).toBe(themes.light);
  });

  it('is chosen in About, over the device’s', async () => {
    const user = userEvent.setup();
    await render(<AboutScreen />);
    expect(screen.getByRole('tab', { name: 'System' })).toBeSelected();
    expect(screen.getByLabelText('Theme')).toHaveStyle({ backgroundColor: themes.light.sunken });
    await user.press(screen.getByRole('tab', { name: 'Dark' }));
    expect(useSettings.getState().theme).toBe('dark');
    expect(screen.getByRole('tab', { name: 'Dark' })).toBeSelected();
    expect(screen.getByLabelText('Theme')).toHaveStyle({ backgroundColor: themes.dark.sunken });
  });
});
