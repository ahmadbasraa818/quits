import { render, screen, userEvent } from '@testing-library/react-native';

import type { Expense, Group } from '@/lib/types';
import { demoGroups } from '@/store/demo';

import { BalanceBars } from '../balance-bars';
import { Chip } from '../chip';
import { yourPart } from '../expense-row';
import { Money } from '../money';
import { Segmented } from '../segmented';

const [japan] = demoGroups(new Date(2026, 9, 3));
const expense = (overrides: Partial<Expense>): Expense => ({
  id: 'x',
  description: 'Dinner',
  amount: 3000,
  paidBy: 'you',
  split: { kind: 'equal', among: ['you', 'aiko', 'ben'] },
  category: 'food',
  date: '2026-10-03',
  createdAt: 0,
  ...overrides,
});

describe('yourPart', () => {
  it('counts what you lent when you paid', () => {
    expect(yourPart(expense({}), 'you')).toEqual({ kind: 'lent', amount: 2000 });
  });
  it('counts what you owe when someone else paid', () => {
    expect(yourPart(expense({ paidBy: 'aiko' }), 'you')).toEqual({ kind: 'owe', amount: 1000 });
  });
  it('says when you were not part of it', () => {
    expect(yourPart(expense({ paidBy: 'aiko', split: { kind: 'equal', among: ['aiko', 'ben'] } }), 'you')).toEqual({ kind: 'none', amount: 0 });
  });
});

describe('Money', () => {
  it('formats and colours by sign', async () => {
    await render(<Money amount={-2500} currency="GBP" colored signed />);
    expect(screen.getByText('-£25.00')).toBeOnTheScreen();
  });
});

describe('BalanceBars', () => {
  it('describes each person in words for screen readers', async () => {
    const group: Group = japan;
    await render(<BalanceBars group={group} balance={{ you: 102940, aiko: -60190, ben: -13810, chloe: -63990, dev: 35050 }} />);
    expect(screen.getByLabelText('You are owed ¥102,940')).toBeOnTheScreen();
    expect(screen.getByLabelText('Chloe owes ¥63,990')).toBeOnTheScreen();
  });
});

describe('Segmented', () => {
  it('marks the chosen option and reports changes', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    await render(
      <Segmented
        label="Sections"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'First' },
          { value: 'b', label: 'Second' },
        ]}
      />
    );
    expect(screen.getByRole('tab', { name: 'First' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Second' })).not.toBeSelected();
    await user.press(screen.getByRole('tab', { name: 'Second' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('Chip', () => {
  it('is a radio by default, and a checkbox when asked', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    const { rerender } = await render(<Chip label="Food" selected onPress={onPress} />);
    expect(screen.getByRole('radio', { name: 'Food' })).toBeChecked();
    await user.press(screen.getByRole('radio', { name: 'Food' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    await rerender(<Chip label="Aiko" selected={false} accessibilityRole="checkbox" onPress={onPress} />);
    expect(screen.getByRole('checkbox', { name: 'Aiko' })).not.toBeChecked();
  });
});
