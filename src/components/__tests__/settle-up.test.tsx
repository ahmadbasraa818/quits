import { act, render, screen, userEvent, within } from '@testing-library/react-native';
import { Share } from 'react-native';

import { useGroups } from '@/store/groups';
import { summarise } from '@/store/summary';

import { SettleUp } from '../settle-up';
import { ToastHost } from '../toast';
import { demoGroups } from '@/store/demo';

const japan = () => useGroups.getState().groups.find((group) => group.id === 'demo_japan')!;

function Settle() {
  const group = useGroups((state) => state.groups.find((item) => item.id === 'demo_japan')!);
  return (
    <>
      <SettleUp group={group} summary={summarise(group)} />
      <ToastHost />
    </>
  );
}

describe('SettleUp', () => {
  beforeEach(async () => {
    await act(async () => useGroups.getState().replaceAll(demoGroups()));
  });

  it('explains why the plan is as short as it is', async () => {
    await render(<Settle />);
    expect(screen.getByTestId('settle-headline')).toHaveTextContent('4 payments settle everyone');
    expect(screen.getByTestId('settle-explanation')).toHaveTextContent('5 people are owed or owe, and their balances only cancel out all together, so 4 payments is the fewest possible.');
  });

  it('records part of a payment, and says what’s still owed', async () => {
    const user = userEvent.setup();
    await render(<Settle />);
    await user.press(screen.getByRole('button', { name: 'Chloe pays You ¥25,829' }));
    const sheet = within(screen.getByTestId('record-payment'));
    expect(sheet.getByLabelText('Amount in Japanese yen')).toHaveDisplayValue('25829');
    await user.clear(sheet.getByLabelText('Amount in Japanese yen'));
    await user.type(sheet.getByLabelText('Amount in Japanese yen'), '10000');
    expect(sheet.getByTestId('payment-partial')).toHaveTextContent('Part of the ¥25,829: ¥15,829 will still be owed.');
    await user.press(sheet.getByRole('button', { name: 'Record payment' }));
    expect(japan().payments).toEqual([expect.objectContaining({ from: 'chloe', to: 'you', amount: 10000 })]);
    expect(screen.getByText('Recorded ¥10,000 from Chloe to you')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Chloe pays You ¥15,829' })).toBeOnTheScreen();
  });

  it('won’t record someone paying themselves', async () => {
    const user = userEvent.setup();
    await render(<Settle />);
    await user.press(screen.getByRole('button', { name: 'Record a payment' }));
    const sheet = within(screen.getByTestId('record-payment'));
    await user.press(sheet.getByTestId('payment-to-you'));
    expect(sheet.getByTestId('payment-problem')).toHaveTextContent('Someone can’t pay themselves.');
    expect(sheet.getByRole('button', { name: 'Record payment' })).toBeDisabled();
  });

  it('lists payments made, and deletes one with an undo', async () => {
    const user = userEvent.setup();
    await act(async () => {
      useGroups.getState().recordPayment('demo_japan', { from: 'dev', to: 'you', amount: 19265, date: '2026-10-03', note: 'Bank transfer' });
    });
    await render(<Settle />);
    expect(screen.getByLabelText(/^Dev paid you ¥19,265, .*, Bank transfer$/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Delete the payment: Dev paid you ¥19,265' }));
    expect(japan().payments).toHaveLength(0);
    await user.press(screen.getByRole('button', { name: 'Undo' }));
    expect(japan().payments).toHaveLength(1);
  });

  it('hands the plan to the share sheet', async () => {
    const user = userEvent.setup();
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    await render(<Settle />);
    await user.press(screen.getByRole('button', { name: 'Share the plan' }));
    expect(share).toHaveBeenCalledWith({ message: expect.stringMatching(/^Settling up for Japan trip:\n• Aiko pays Ben ¥116,395\n/) });
    share.mockRestore();
  });
});
