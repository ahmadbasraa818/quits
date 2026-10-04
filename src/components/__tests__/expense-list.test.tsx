import { act, render, screen, userEvent } from '@testing-library/react-native';

import type { Expense, Group } from '@/lib/types';
import { useGroups } from '@/store/groups';

import { ExpenseList } from '../expense-list';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
// Swiping is tested by hand and end to end; here the rows only need to render.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({ __esModule: true, default: ({ children }: { children: unknown }) => children }));

const japan = () => useGroups.getState().groups.find((group) => group.id === 'demo_japan')!;

describe('ExpenseList', () => {
  beforeEach(async () => {
    await act(async () => useGroups.getState().resetDemo());
  });

  it('finds expenses by what they were for', async () => {
    const user = userEvent.setup();
    await render(<ExpenseList group={japan()} />);
    await user.type(screen.getByLabelText('Search expenses'), 'RAMEN');
    expect(screen.getByTestId('filter-summary')).toHaveTextContent('1 expense · ¥7,480');
    expect(screen.getByRole('button', { name: /^Ichiran ramen/ })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Ryokan/ })).toBeNull();
  });

  it('narrows to a category, and clears', async () => {
    const user = userEvent.setup();
    await render(<ExpenseList group={japan()} />);
    await user.press(screen.getByRole('radio', { name: 'Stay' }));
    expect(screen.getByTestId('filter-summary')).toHaveTextContent('2 expenses · ¥294,000');
    await user.press(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByTestId('filter-summary')).toBeNull();
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
  });

  it('says when nothing matches', async () => {
    const user = userEvent.setup();
    await render(<ExpenseList group={japan()} />);
    await user.type(screen.getByLabelText('Search expenses'), 'sushi');
    expect(screen.getByTestId('filter-summary')).toHaveTextContent('Nothing matches');
  });

  it('shows a long history fifty at a time', async () => {
    const user = userEvent.setup();
    const many: Expense[] = Array.from({ length: 120 }, (_, i) => ({
      id: `e${i}`,
      description: `Coffee ${i}`,
      amount: 300,
      paidBy: 'you',
      split: { kind: 'equal', among: ['you', 'aiko'] },
      category: 'drinks',
      date: `2026-0${1 + (i % 9)}-1${i % 10}`,
      createdAt: i,
    }));
    const group: Group = { ...japan(), expenses: many };
    await render(<ExpenseList group={group} />);
    expect(screen.getAllByRole('button', { name: /^Coffee \d+,/ })).toHaveLength(50);
    await user.press(screen.getByRole('button', { name: 'Show 50 more' }));
    expect(screen.getAllByRole('button', { name: /^Coffee \d+,/ })).toHaveLength(100);
    await user.press(screen.getByRole('button', { name: 'Show 20 more' }));
    expect(screen.getAllByRole('button', { name: /^Coffee \d+,/ })).toHaveLength(120);
    expect(screen.queryByTestId('show-more')).toBeNull();
  });
});
