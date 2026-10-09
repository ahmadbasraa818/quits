import { act, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import ExpenseScreen from '@/app/group/[id]/expense';
import GroupSettingsScreen from '@/app/group/[id]/settings';
import GroupsScreen from '@/app/index';
import { dayLabel, daysAgo } from '@/lib/dates';
import { nextDate, repeatFrom } from '@/lib/repeat';
import { demoGroups } from '@/store/demo';
import { useGroups } from '@/store/groups';
import { useSettings } from '@/store/settings';

import { saveTextFile } from '../backup-file';
import { ExpenseRow } from '../expense-row';
import { ToastHost, useToast } from '../toast';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true, canDismiss: () => false, dismissAll: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useIsFocused: () => true,
}));
jest.mock('../backup-file', () => ({ saveTextFile: jest.fn(() => Promise.resolve()) }));

const flat = () => useGroups.getState().groups.find((group) => group.id === 'demo_flat')!;
const groupNamed = (name: string) => useGroups.getState().groups.find((group) => group.name === name);

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  await act(async () => {
    useGroups.getState().replaceAll(demoGroups());
    useSettings.setState({ welcomeDone: true, seenVersion: null });
  });
});

describe('a repeating expense', () => {
  it('starts from the form, saying when the next is added', async () => {
    const user = userEvent.setup();
    mockParams = { id: 'demo_flat' };
    await render(<ExpenseScreen />);
    await user.type(screen.getByTestId('amount'), '30');
    await user.type(screen.getByTestId('description'), 'Cleaner');
    await user.press(screen.getByRole('tab', { name: 'Monthly' }));
    const today = daysAgo(0);
    expect(screen.getByTestId('repeat-note')).toHaveTextContent(`The next is added on ${dayLabel(nextDate(today, repeatFrom('month', today)))}, then every month after.`);
    await user.press(screen.getByTestId('save-expense'));
    expect(flat().expenses.find((expense) => expense.description === 'Cleaner')?.repeat).toEqual({ every: 'month', day: new Date().getDate() });
  });

  it('can be stopped from the newest in the series', async () => {
    const user = userEvent.setup();
    const broadband = flat().expenses.find((expense) => expense.description === 'Broadband')!;
    mockParams = { id: 'demo_flat', expenseId: broadband.id };
    await render(<ExpenseScreen />);
    expect(screen.getByRole('tab', { name: 'Monthly' })).toBeSelected();
    await user.press(screen.getByRole('tab', { name: 'Never' }));
    await user.press(screen.getByTestId('save-expense'));
    expect(flat().expenses.find((expense) => expense.id === broadband.id)?.repeat).toBeUndefined();
  });

  it('isn’t offered on an older expense, which would start a second schedule', async () => {
    const energy = flat().expenses.find((expense) => expense.description === 'Energy bill')!;
    mockParams = { id: 'demo_flat', expenseId: energy.id };
    await render(<ExpenseScreen />);
    expect(screen.queryByRole('tab', { name: 'Monthly' })).toBeNull();
  });

  it('says on its row how often it comes', async () => {
    const broadband = flat().expenses.find((expense) => expense.description === 'Broadband')!;
    await render(<ExpenseRow expense={broadband} group={flat()} onPress={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByText(/Sam paid · every month/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Broadband, £32\.00, paid by Sam, you owe £10\.67, repeats every month$/)).toBeOnTheScreen();
  });
});

describe('a group’s settings', () => {
  it('exports the group as a spreadsheet', async () => {
    const user = userEvent.setup();
    mockParams = { id: 'demo_flat' };
    await render(<GroupSettingsScreen />);
    await user.press(screen.getByTestId('export-csv'));
    expect(saveTextFile).toHaveBeenCalledWith(`quits-flat-4b-${daysAgo(0)}.csv`, expect.stringMatching(/^﻿Date,Type,Description,/), 'csv');
  });

  it('archives a group, saying first if there’s still money owed, and can undo it', async () => {
    const user = userEvent.setup();
    mockParams = { id: 'demo_flat' };
    await render(
      <>
        <GroupSettingsScreen />
        <ToastHost />
      </>
    );
    expect(screen.getByTestId('archive-note')).toHaveTextContent(/^There are still payments to settle\./);
    await user.press(screen.getByTestId('archive-group'));
    expect(flat().archived).toBe(true);
    expect(router.dismissTo).toHaveBeenCalledWith('/');
    expect(useToast.getState().toast?.message).toBe('Archived Flat 4B');
    await act(async () => useToast.getState().toast?.action?.onPress());
    expect(flat()).not.toHaveProperty('archived');
  });

  it('brings an archived group back', async () => {
    const user = userEvent.setup();
    await act(async () => useGroups.getState().setArchived('demo_brighton', true));
    mockParams = { id: 'demo_brighton' };
    await render(<GroupSettingsScreen />);
    await user.press(screen.getByTestId('unarchive-group'));
    expect(groupNamed('Brighton day trip')).not.toHaveProperty('archived');
  });
});

describe('the groups list', () => {
  it('folds archived groups away, and leaves them out of the totals', async () => {
    const user = userEvent.setup();
    await act(async () => useGroups.getState().setArchived('demo_japan', true));
    await render(<GroupsScreen />);
    // The Japan trip's ¥46,134 is out of the totals; the flat's £55.30 stays.
    expect(screen.queryByText('¥46,134')).toBeNull();
    expect(screen.getByText('£55.30')).toBeOnTheScreen();
    expect(screen.queryByTestId('group-demo_japan')).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Archived groups, 1' }));
    expect(screen.getByTestId('group-demo_japan')).toBeOnTheScreen();
  });
});
