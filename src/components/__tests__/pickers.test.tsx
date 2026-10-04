import { render, screen, userEvent } from '@testing-library/react-native';

import { Calendar, DateField } from '../calendar';
import { ConfirmDialog } from '../confirm';
import { CurrencyField } from '../currency-picker';

describe('Calendar', () => {
  it('opens on the chosen month, moves between months, and picks a day', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    await render(<Calendar value="2026-10-04" onChange={onChange} today="2026-10-04" />);
    expect(screen.getByText('October 2026')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sunday 4 October 2026, today' })).toBeSelected();
    await user.press(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('November 2026')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Saturday 21 November 2026' }));
    expect(onChange).toHaveBeenCalledWith('2026-11-21');
    await user.press(screen.getByRole('button', { name: 'Previous month' }));
    await user.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('September 2026')).toBeOnTheScreen();
  });
});

describe('DateField', () => {
  it('says the date in full, and opens a calendar with shortcuts', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    jest.useFakeTimers({ now: new Date(2026, 9, 4, 12), advanceTimers: true });
    await render(<DateField value="2026-10-02" onChange={onChange} />);
    await user.press(screen.getByRole('button', { name: 'Date: Friday 2 October 2026' }));
    await user.press(screen.getByRole('radio', { name: 'Yesterday' }));
    expect(onChange).toHaveBeenCalledWith('2026-10-03');
    jest.useRealTimers();
  });
});

describe('CurrencyField', () => {
  it('opens a searchable list and picks from it', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    await render(<CurrencyField value="GBP" onChange={onChange} />);
    await user.press(screen.getByRole('button', { name: 'Currency: British pound, GBP' }));
    expect(screen.getByRole('radio', { name: 'British pound, GBP' })).toBeChecked();
    await user.type(screen.getByLabelText('Search currencies'), 'won');
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    await user.press(screen.getByRole('radio', { name: 'South Korean won, KRW' }));
    expect(onChange).toHaveBeenCalledWith('KRW');
  });

  it('says when nothing matches', async () => {
    const user = userEvent.setup();
    await render(<CurrencyField value="GBP" onChange={jest.fn()} />);
    await user.press(screen.getByRole('button', { name: 'Currency: British pound, GBP' }));
    await user.type(screen.getByLabelText('Search currencies'), 'doubloons');
    expect(screen.getByText('No currency matches “doubloons”.')).toBeOnTheScreen();
  });

  it('can be shown but not changed', async () => {
    await render(<CurrencyField value="JPY" onChange={jest.fn()} disabled label="Group currency" />);
    expect(screen.getByRole('button', { name: 'Group currency: Japanese yen, JPY' })).toBeDisabled();
  });
});

describe('ConfirmDialog', () => {
  it('confirms or cancels', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await render(<ConfirmDialog visible title="Delete Flat 4B?" message="This removes it." confirmLabel="Delete group" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('header', { name: 'Delete Flat 4B?' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Delete group' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
