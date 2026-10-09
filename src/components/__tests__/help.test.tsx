import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import AboutScreen from '@/app/about';
import HelpScreen from '@/app/help';
import { demoGroups } from '@/store/demo';
import { useGroups } from '@/store/groups';
import { useSettings } from '@/store/settings';

import { HelpLink } from '../help-link';
import { useToast } from '../toast';
import { WelcomeCard } from '../welcome-card';
import { RELEASES, WhatsNewOnUpdate } from '../whats-new';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false, canDismiss: () => false, dismissAll: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  await act(async () => {
    useGroups.getState().replaceAll(demoGroups());
    useSettings.setState({ welcomeDone: false, seenVersion: RELEASES[0].version });
  });
});

describe('the help centre', () => {
  it('lists every topic, and opens an answer with a way to see it', async () => {
    const user = userEvent.setup();
    await render(<HelpScreen />);
    for (const topic of ['Getting started', 'Adding expenses', 'Settling up', 'Sharing and backups', 'Your data']) expect(screen.getByText(topic)).toBeOnTheScreen();

    await user.press(screen.getByText('How do I split a bill item by item?'));
    expect(screen.getByText(/choose Items under Split/)).toBeOnTheScreen();
    await user.press(screen.getByTestId('show-items'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/group/[id]/expense', params: { id: 'demo_japan', split: 'items' } });
  });

  it('searches as you type, and says when nothing matches', async () => {
    const user = userEvent.setup();
    await render(<HelpScreen />);
    await user.type(screen.getByTestId('help-search'), 'exchange rate');
    expect(screen.getByText('What if something was paid in another currency?')).toBeOnTheScreen();
    expect(screen.queryByText('Getting started')).toBeNull();

    await user.clear(screen.getByTestId('help-search'));
    await user.type(screen.getByTestId('help-search'), 'zebra');
    expect(screen.getByTestId('help-none')).toHaveTextContent(/^No answers match “zebra”/);
  });

  it('puts the answer first when opened from a “?”', async () => {
    mockParams = { entry: 'fewest' };
    await render(<HelpScreen />);
    expect(screen.getByTestId('asked')).toHaveTextContent(/How does Quits find the fewest payments\?/);
  });

  it('opens from a “?” at the answer about the thing beside it', async () => {
    const user = userEvent.setup();
    await render(<HelpLink id="currency" />);
    await user.press(screen.getByLabelText('Help: What if something was paid in another currency?'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/help', params: { entry: 'currency' } });
  });
});

describe('welcoming someone new', () => {
  it('shows three steps and the demo to try, until put away', async () => {
    const user = userEvent.setup();
    await render(<WelcomeCard />);
    expect(screen.getByText('New to Quits?')).toBeOnTheScreen();
    expect(screen.getByText('Settle in the fewest payments')).toBeOnTheScreen();
    await user.press(screen.getByTestId('welcome-dismiss'));
    expect(screen.queryByText('New to Quits?')).toBeNull();
    expect(useSettings.getState().welcomeDone).toBe(true);
  });

  it('goes once the person has a group of their own', async () => {
    await act(async () => {
      useGroups.getState().createGroup({ name: 'Ski trip', currency: 'EUR', memberNames: ['Lena'] });
    });
    await render(<WelcomeCard />);
    expect(screen.queryByTestId('welcome-card')).toBeNull();
  });
});

describe('what’s new', () => {
  it('shows what changed since the person last looked, once', async () => {
    const user = userEvent.setup();
    await act(async () => useSettings.setState({ seenVersion: '2.0.0' }));
    await render(<WhatsNewOnUpdate />);
    expect(screen.getByText(RELEASES[0].title)).toBeOnTheScreen();
    expect(screen.queryByText('Safe by default')).toBeNull();
    await user.press(screen.getByTestId('whats-new-done'));
    expect(useSettings.getState().seenVersion).toBe(RELEASES[0].version);
    await waitFor(() => expect(screen.queryByText(RELEASES[0].title)).toBeNull());
  });
});

describe('About', () => {
  it('opens help, and the full list of what’s new', async () => {
    const user = userEvent.setup();
    await render(<AboutScreen />);
    await user.press(screen.getByTestId('open-help'));
    expect(router.push).toHaveBeenCalledWith('/help');
    await user.press(screen.getByTestId('open-changes'));
    for (const release of RELEASES) expect(screen.getByText(release.title)).toBeOnTheScreen();
  });

  it('removes the demo groups, with a way to undo', async () => {
    const user = userEvent.setup();
    await render(<AboutScreen />);
    await user.press(screen.getByTestId('remove-demo'));
    expect(useGroups.getState().groups).toEqual([]);
    const toast = useToast.getState().toast;
    expect(toast?.message).toBe('Removed the demo groups');
    await act(async () => toast?.action?.onPress());
    expect(useGroups.getState().groups.map((group) => group.id)).toEqual(['demo_japan', 'demo_flat', 'demo_brighton']);
  });
});
