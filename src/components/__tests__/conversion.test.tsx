import { render, screen, userEvent } from '@testing-library/react-native';

import type { Rate } from '@/lib/fx';
import type { EcbRate } from '@/store/rates';

import { Conversion, PinnedRate } from '../conversion';

const passes: Rate = { base: 'GBP', value: '207.31' };
const ready = (date: string): EcbRate => ({ status: 'ready', quote: { rate: passes, date } });

const show = (props: Partial<Parameters<typeof Conversion>[0]> = {}) =>
  render(
    <Conversion
      amount={131000}
      from="GBP"
      to="JPY"
      date="2026-10-02"
      rate={passes}
      converted={271576}
      pinned={null}
      ecb={ready('2026-10-02')}
      onPin={jest.fn()}
      {...props}
    />
  );

describe('Conversion', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date(2026, 9, 4, 12), advanceTimers: true }));
  afterEach(() => jest.useRealTimers());

  it('shows what it comes to, and the ECB rate behind it', async () => {
    await show();
    expect(screen.getByLabelText('Comes to ¥271,576')).toBeOnTheScreen();
    expect(screen.getByTestId('rate')).toHaveTextContent('£1 = ¥207.31 · ECB rate for Fri 2 Oct');
  });

  it('says when the ECB rate is from an earlier day', async () => {
    await show({ date: '2026-10-04', ecb: ready('2026-10-02') });
    expect(screen.getByTestId('rate')).toHaveTextContent('£1 = ¥207.31 · ECB rate for Fri 2 Oct, the latest before today');
  });

  it('asks for a rate the ECB doesn’t publish, starting from the group’s currency', async () => {
    const user = userEvent.setup();
    const onPin = jest.fn();
    await show({
      from: 'VND',
      to: 'GBP',
      amount: 150000,
      rate: null,
      converted: null,
      ecb: { status: 'unavailable', reason: 'unsupported', retry: jest.fn() },
      onPin,
    });
    expect(screen.getByTestId('rate-unavailable')).toHaveTextContent('The ECB doesn’t publish a rate for Vietnamese đồng, so enter it yourself.');
    expect(screen.getByRole('button', { name: 'Use this rate' })).toBeDisabled();
    await user.type(screen.getByLabelText('How many Vietnamese đồng one British pound buys'), '33,000');
    // Read back, so a thousands comma can't quietly become a decimal point.
    expect(screen.getByTestId('rate-preview')).toHaveTextContent('Reads as £1 = ₫33,000');
    await user.press(screen.getByRole('button', { name: 'Use this rate' }));
    expect(onPin).toHaveBeenCalledWith({ rate: { base: 'GBP', value: '33000' }, source: 'typed' });
  });

  it('turns a rate round to type it the other way', async () => {
    const user = userEvent.setup();
    const onPin = jest.fn();
    await show({ onPin });
    await user.press(screen.getByRole('button', { name: 'Change rate' }));
    await user.press(screen.getByRole('button', { name: 'Enter it as one Japanese yen in British pounds instead' }));
    expect(screen.getByLabelText('How many British pounds one Japanese yen buys')).toHaveDisplayValue('0.00482369');
    await user.press(screen.getByRole('button', { name: 'Use this rate' }));
    expect(onPin).toHaveBeenCalledWith({ rate: { base: 'JPY', value: '0.00482369' }, source: 'typed' });
  });

  it('offers the ECB rate back after a typed one', async () => {
    const user = userEvent.setup();
    const onPin = jest.fn();
    const pinned: PinnedRate = { rate: { base: 'GBP', value: '200' }, source: 'typed' };
    await show({ pinned, rate: pinned.rate, converted: 262000, ecb: { status: 'idle' }, onPin });
    expect(screen.getByTestId('rate')).toHaveTextContent('£1 = ¥200 · Your rate');
    await user.press(screen.getByRole('button', { name: 'Use the ECB rate' }));
    expect(onPin).toHaveBeenCalledWith(null);
  });

  it('offers to try again without a connection', async () => {
    const user = userEvent.setup();
    const retry = jest.fn();
    await show({ rate: null, converted: null, ecb: { status: 'unavailable', reason: 'offline', retry } });
    expect(screen.getByTestId('rate-unavailable')).toHaveTextContent('No connection to look up the rate. Enter it yourself, or try again.');
    await user.press(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });
});
