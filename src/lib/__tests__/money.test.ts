import * as fc from 'fast-check';

import { formatMoney, parseAmount, toInputString } from '../money';

describe('parseAmount', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['0.05', 5],
    ['.5', 50],
    ['1,234.56', 123456],
    ['£ 7.20', 720],
  ])('reads %p as %p pence', (text, minor) => {
    expect(parseAmount(text, 'GBP')).toBe(minor);
  });

  it('reads yen without decimals', () => {
    expect(parseAmount('96,000', 'JPY')).toBe(96000);
    expect(parseAmount('96000.5', 'JPY')).toBeNull();
  });

  it.each(['', '.', 'abc', '12.345', '1.2.3', '-5', '12e3'])('rejects %p', (text) => {
    expect(parseAmount(text, 'GBP')).toBeNull();
  });

  it('rejects amounts past the limit', () => {
    expect(parseAmount('999999999999', 'GBP')).toBeNull();
  });

  it('round-trips with toInputString', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000_000 }), fc.constantFrom('GBP', 'EUR', 'USD', 'JPY' as const), (minor, currency) => {
        expect(parseAmount(toInputString(minor, currency), currency)).toBe(minor);
      })
    );
  });
});

describe('formatMoney', () => {
  it('formats each currency the way people write it', () => {
    expect(formatMoney(123450, 'GBP')).toBe('£1,234.50');
    expect(formatMoney(500, 'USD')).toBe('$5.00');
    expect(formatMoney(1200, 'EUR')).toBe('€12.00');
    expect(formatMoney(96000, 'JPY')).toBe('¥96,000');
  });

  it('can sign gains and losses', () => {
    expect(formatMoney(2500, 'GBP', { signed: true })).toBe('+£25.00');
    expect(formatMoney(-2500, 'GBP', { signed: true })).toBe('-£25.00');
    expect(formatMoney(0, 'GBP', { signed: true })).toBe('£0.00');
  });
});
