import { act, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useDraft } from '@/store/draft';
import { useGroups } from '@/store/groups';

import { QuickAdd } from '../quick-add';
import { ToastHost } from '../toast';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const japan = () => useGroups.getState().groups.find((group) => group.id === 'demo_japan')!;

function Quick({ onClose = jest.fn() }: { onClose?: () => void }) {
  const group = useGroups((state) => state.groups.find((item) => item.id === 'demo_japan')!);
  return (
    <>
      <QuickAdd group={group} visible onClose={onClose} />
      <ToastHost />
    </>
  );
}

describe('QuickAdd', () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 4, 12), advanceTimers: true });
    await act(async () => useGroups.getState().resetDemo());
  });
  afterEach(() => jest.useRealTimers());

  it('offers sentences to try, made from the group', async () => {
    const user = userEvent.setup();
    await render(<Quick />);
    await user.press(screen.getByRole('button', { name: 'Try: Lunch ¥2,400 split with Aiko' }));
    expect(screen.getByLabelText('Describe the expense')).toHaveDisplayValue('Lunch ¥2,400 split with Aiko');
    expect(screen.getByTestId('quick-split')).toHaveTextContent('You and Aiko · ¥1,200 each');
  });

  it('shows what it read, and adds it', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    await render(<Quick onClose={onClose} />);
    await user.type(screen.getByLabelText('Describe the expense'), 'Ramen ¥4,800, Aiko paid, split with Ben and me');
    expect(screen.getByTestId('quick-amount')).toHaveTextContent('¥4,800');
    expect(screen.getByTestId('quick-what')).toHaveTextContent('Ramen · Food');
    expect(screen.getByTestId('quick-payer')).toHaveTextContent(/Aiko paid$/);
    expect(screen.getByTestId('quick-split')).toHaveTextContent('You, Aiko and Ben · ¥1,600 each');
    expect(screen.getByTestId('quick-date')).toHaveTextContent('Todayassumed');
    await user.press(screen.getByRole('button', { name: 'Add expense' }));
    expect(japan().expenses.find((expense) => expense.description === 'Ramen')).toMatchObject({
      amount: 4800,
      paidBy: 'aiko',
      split: { kind: 'equal', among: ['you', 'aiko', 'ben'] },
      category: 'food',
      date: '2026-10-04',
    });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('Added Ramen')).toBeOnTheScreen();
  });

  it('waits for an amount, and warns about strangers', async () => {
    const user = userEvent.setup();
    await render(<Quick />);
    await user.type(screen.getByLabelText('Describe the expense'), 'Dinner with Bob');
    expect(screen.getByText('Still needed: an amount.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add expense' })).toBeDisabled();
    expect(screen.getByTestId('quick-strangers')).toHaveTextContent('Bob isn’t in Japan trip. Add them in group settings first.');
  });

  it('hands the draft to the full form', async () => {
    const user = userEvent.setup();
    await render(<Quick />);
    await user.type(screen.getByLabelText('Describe the expense'), 'Taxi 2,400 for everyone except Dev');
    await user.press(screen.getByRole('button', { name: 'Open in the full form' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/group/[id]/expense', params: { id: 'demo_japan' } });
    expect(useDraft.getState().take('demo_japan')).toMatchObject({ amount: 2400, description: 'Taxi', among: ['you', 'aiko', 'ben', 'chloe'] });
    expect(useDraft.getState().take('demo_japan')).toBeNull();
  });
});
