import { act, fireEvent, render, screen, userEvent, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Share } from 'react-native';

import AboutScreen from '@/app/about';
import type { PayMethod } from '@/lib/pay';
import type { Group } from '@/lib/types';
import { useGroups } from '@/store/groups';
import { useSettings } from '@/store/settings';
import { summarise } from '@/store/summary';

import { PayMethods } from '../pay-methods';
import { SettleUp } from '../settle-up';
import { ToastHost, useToast } from '../toast';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false, canDismiss: () => false, dismissAll: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-linking', () => ({ openURL: jest.fn(() => Promise.resolve(true)) }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

/** A weekend where Rui paid for dinner: you and Ana each owe him €30. */
const lisbon = (pay?: PayMethod[]): Group => ({
  id: 'g_lisbon',
  name: 'Lisbon weekend',
  currency: 'EUR',
  me: 'you',
  createdAt: 1,
  members: [
    { id: 'you', name: 'You', tone: 0 },
    { id: 'rui', name: 'Rui', tone: 2, ...(pay ? { pay } : {}) },
    { id: 'ana', name: 'Ana', tone: 4 },
  ],
  expenses: [{ id: 'e1', description: 'Dinner', amount: 9000, paidBy: 'rui', split: { kind: 'equal', among: ['you', 'rui', 'ana'] }, category: 'food', date: '2026-10-08', createdAt: 1 }],
  payments: [],
});

const rui = () => useGroups.getState().groups[0].members.find((member) => member.id === 'rui')!;

function Settle() {
  const group = useGroups((state) => state.groups[0]);
  return (
    <>
      <SettleUp group={group} summary={summarise(group)} />
      <ToastHost />
    </>
  );
}

function Person({ memberId }: { memberId: string }) {
  const group = useGroups((state) => state.groups[0]);
  return (
    <>
      <PayMethods group={group} memberId={memberId} />
      <ToastHost />
    </>
  );
}

const start = (pay?: PayMethod[]) =>
  act(async () => {
    useGroups.getState().replaceAll([lisbon(pay)]);
    useSettings.setState({ haptics: true, reminded: {} });
  });

beforeEach(() => jest.clearAllMocks());

describe('paying someone', () => {
  it('opens each way they get paid, asking for the amount where it can', async () => {
    const user = userEvent.setup();
    await start([
      { kind: 'paypal', handle: 'rui' },
      { kind: 'revolut', handle: 'ruirev' },
    ]);
    await render(<Settle />);
    await user.press(screen.getByRole('button', { name: 'Pay with PayPal' }));
    expect(Linking.openURL).toHaveBeenCalledWith('https://paypal.me/rui/30.00EUR');
    expect(screen.getByRole('button', { name: 'Pay with Revolut' })).toHaveProp('accessibilityHint', 'Opens Revolut, where you type in €30.00');
    expect(screen.getByRole('button', { name: 'Pay with PayPal' })).toHaveProp('accessibilityHint', 'Opens PayPal with €30.00 filled in');
  });

  it('gives a tap you can feel when it’s marked paid', async () => {
    const user = userEvent.setup();
    await start([{ kind: 'paypal', handle: 'rui' }]);
    await render(<Settle />);
    await user.press(screen.getByTestId('pay-you-rui'));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('asks how someone gets paid when they haven’t said', async () => {
    const user = userEvent.setup();
    await start();
    await render(<Settle />);
    await user.press(screen.getByRole('button', { name: 'How does Rui get paid?' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/group/[id]/member/[memberId]', params: { id: 'g_lisbon', memberId: 'rui', pay: 'add' } });
  });
});

describe('reminding someone', () => {
  it('sends what they owe with the links to pay, and notes when', async () => {
    const user = userEvent.setup();
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    await start([{ kind: 'paypal', handle: 'rui' }]);
    await render(<Settle />);
    // Your own payment has no reminder: it's yours to make.
    expect(screen.queryByRole('button', { name: 'Remind You' })).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Remind Ana' }));
    expect(share).toHaveBeenCalledWith({ message: 'Hi Ana, a quick reminder from Lisbon weekend: you owe Rui €30.00.\n\nTo pay Rui:\nPayPal: https://paypal.me/rui/30.00EUR\n\nThanks!' });
    expect(await screen.findByTestId('reminded-ana-rui')).toHaveTextContent('Reminded today');
  });

  it('notes nothing when the reminder isn’t sent', async () => {
    const user = userEvent.setup();
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
    await start();
    await render(<Settle />);
    await user.press(screen.getByRole('button', { name: 'Remind Ana' }));
    expect(screen.queryByTestId('reminded-ana-rui')).toBeNull();
    expect(useSettings.getState().reminded).toEqual({});
  });
});

describe('adding how someone gets paid', () => {
  it('reads a pasted link, and says what it opens', async () => {
    const user = userEvent.setup();
    await start();
    await render(<Person memberId="rui" />);
    expect(screen.getByText(/Add how Rui gets paid, and whoever owes Rui gets a button to pay/)).toBeOnTheScreen();
    await user.press(screen.getByTestId('add-pay'));
    const sheet = within(screen.getByTestId('pay-sheet'));
    await user.press(sheet.getByRole('radio', { name: 'Monzo' }));
    await user.type(sheet.getByTestId('pay-handle'), 'https://monzo.me/rui/5.00');
    expect(sheet.getByTestId('pay-preview')).toHaveTextContent('Opens monzo.me/rui. The amount is filled in for groups in pounds.');
    await user.press(sheet.getByRole('button', { name: 'Add Monzo' }));
    expect(rui().pay).toEqual([{ kind: 'monzo', handle: 'rui' }]);
    expect(screen.getByLabelText('Monzo: monzo.me/rui')).toBeOnTheScreen();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('turns away what isn’t a username, and one already there', async () => {
    const user = userEvent.setup();
    await start([{ kind: 'paypal', handle: 'rui' }]);
    await render(<Person memberId="rui" />);
    await user.press(screen.getByTestId('add-pay'));
    const sheet = within(screen.getByTestId('pay-sheet'));
    await user.type(sheet.getByTestId('pay-handle'), 'two words');
    expect(sheet.getByTestId('pay-preview')).toHaveTextContent('That doesn’t look like a PayPal name.');
    expect(sheet.getByRole('button', { name: 'Add PayPal' })).toBeDisabled();
    await user.clear(sheet.getByTestId('pay-handle'));
    await user.type(sheet.getByTestId('pay-handle'), 'RUI');
    expect(sheet.getByTestId('pay-preview')).toHaveTextContent('That’s already here.');
    expect(sheet.getByRole('button', { name: 'Add PayPal' })).toBeDisabled();
  });

  it('removes one, with a way to undo', async () => {
    const user = userEvent.setup();
    await start([
      { kind: 'paypal', handle: 'rui' },
      { kind: 'link', handle: 'https://bunq.me/rui' },
    ]);
    await render(<Person memberId="rui" />);
    await user.press(screen.getByRole('button', { name: 'Remove PayPal: paypal.me/rui' }));
    expect(rui().pay).toEqual([{ kind: 'link', handle: 'https://bunq.me/rui' }]);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
    await act(async () => useToast.getState().toast?.action?.onPress());
    expect(rui().pay).toEqual([
      { kind: 'paypal', handle: 'rui' },
      { kind: 'link', handle: 'https://bunq.me/rui' },
    ]);
  });

  it('stops at three', async () => {
    await start([
      { kind: 'paypal', handle: 'rui' },
      { kind: 'monzo', handle: 'rui' },
      { kind: 'revolut', handle: 'rui' },
    ]);
    await render(<Person memberId="rui" />);
    expect(screen.queryByTestId('add-pay')).toBeNull();
  });

  it('speaks to you about your own', async () => {
    await start();
    await render(<Person memberId="you" />);
    expect(screen.getByText('How you get paid')).toBeOnTheScreen();
    expect(screen.getByText(/Your reminders include it too/)).toBeOnTheScreen();
  });
});

describe('haptics', () => {
  it('can be turned off in About', async () => {
    await start();
    await render(<AboutScreen />);
    await act(async () => fireEvent(screen.getByTestId('haptics-switch'), 'valueChange', false));
    expect(useSettings.getState().haptics).toBe(false);
  });

  it('stay quiet once turned off', async () => {
    const user = userEvent.setup();
    await start();
    await act(async () => useSettings.setState({ haptics: false }));
    await render(<Settle />);
    await user.press(screen.getByTestId('pay-you-rui'));
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('taps once to say they’re back on', async () => {
    await act(async () => useSettings.setState({ haptics: false }));
    await render(<AboutScreen />);
    await act(async () => fireEvent(screen.getByTestId('haptics-switch'), 'valueChange', true));
    expect(useSettings.getState().haptics).toBe(true);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });
});
