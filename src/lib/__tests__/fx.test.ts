import * as fc from 'fast-check';

import { convert, describeRate, invertedValue, parseRateValue, Rate } from '../fx';
import { CURRENCIES, CURRENCY_CODES, CurrencyCode } from '../money';

const gbpInYen: Rate = { base: 'GBP', value: '208.14' };

describe('parseRateValue', () => {
  it.each([
    ['208.14', '208.14'],
    [' 208.140 ', '208.14'],
    ['1,5', '1.5'],
    ['1,1667', '1.1667'],
    ['33,000', '33000'],
    ['1,234,567', '1234567'],
    ['26.300,5', '26300.5'],
    ['26,300.5', '26300.5'],
    ['007', '7'],
    ['0.0048', '0.0048'],
    ['1.0000000001', '1.0000000001'],
  ])('reads %p as %p', (text, value) => {
    expect(parseRateValue(text)).toBe(value);
  });

  it.each(['', '0', '0.000', '-2', 'abc', '1.2.3', '1e3', '1.00000000001', '1234567890', '12,34,567', '1,2345,678'])('rejects %p', (text) => {
    expect(parseRateValue(text)).toBeNull();
  });
});

describe('convert', () => {
  it('multiplies exactly and rounds once, half up', () => {
    // £12.34 × 208.14 = ¥2,568.4476.
    expect(convert(1234, 'GBP', 'JPY', gbpInYen)).toBe(2568);
    // £0.01 × 208.14 = ¥2.0814.
    expect(convert(1, 'GBP', 'JPY', gbpInYen)).toBe(2);
    // ¥2,568 ÷ 208.14 = £12.3378…
    expect(convert(2568, 'JPY', 'GBP', gbpInYen)).toBe(1234);
    // A half rounds up: £1.00 at 0.125 is 12.5p.
    expect(convert(100, 'GBP', 'EUR', { base: 'GBP', value: '0.125' })).toBe(13);
  });

  it('leaves an amount alone in its own currency', () => {
    expect(convert(4200, 'EUR', 'EUR', { base: 'EUR', value: '9' })).toBe(4200);
  });

  it('refuses a rate between other currencies', () => {
    expect(() => convert(100, 'GBP', 'JPY', { base: 'USD', value: '150' })).toThrow();
  });

  it('stays exact where floating point would drift', () => {
    // 0.1 + 0.2 trouble: £1,000,000.00 at 1.1 is exactly €1,100,000.00.
    expect(convert(100_000_000, 'GBP', 'EUR', { base: 'GBP', value: '1.1' })).toBe(110_000_000);
    // The largest amount at a ten-decimal rate: past 2^53 along the way, exact at the end.
    expect(convert(10_000_000_000, 'GBP', 'IDR', { base: 'GBP', value: '21345.1234567891' })).toBe(213_451_234_567_891);
  });

  const pair = fc.tuple(fc.constantFrom(...CURRENCY_CODES), fc.constantFrom(...CURRENCY_CODES)).filter(([a, b]) => a !== b);
  const rateValue = fc.integer({ min: 1, max: 99_999_999 }).map((n) => String(n / 10_000));

  it('rounds to the nearest minor unit of the exact answer', () => {
    fc.assert(
      fc.property(pair, rateValue, fc.integer({ min: 0, max: 1_000_000_000 }), ([from, to], value, amount) => {
        const rate: Rate = { base: from, value: parseRateValue(value)! };
        const exact = (amount / 10 ** CURRENCIES[from].decimals) * Number(rate.value) * 10 ** CURRENCIES[to].decimals;
        expect(Math.abs(convert(amount, from, to, rate) - exact)).toBeLessThanOrEqual(0.5 + exact * 1e-12);
      })
    );
  });

  it('never makes a larger payment come to less', () => {
    fc.assert(
      fc.property(pair, rateValue, fc.integer({ min: 0, max: 1_000_000_000 }), fc.integer({ min: 0, max: 1000 }), ([from, to], value, amount, extra) => {
        const rate: Rate = { base: to, value: parseRateValue(value)! };
        expect(convert(amount + extra, from, to, rate)).toBeGreaterThanOrEqual(convert(amount, from, to, rate));
      })
    );
  });
});

describe('describing a rate', () => {
  it('reads as one of the base currency', () => {
    expect(describeRate(gbpInYen, 'JPY')).toBe('£1 = ¥208.14');
    expect(describeRate({ base: 'EUR', value: '26300.5' }, 'VND' as CurrencyCode)).toBe('€1 = ₫26,300.5');
    expect(describeRate({ base: 'CHF', value: '1.07' }, 'EUR')).toBe('CHF 1 = €1.07');
  });

  it('turns a rate round for typing it the other way', () => {
    expect(invertedValue('208.14')).toBe('0.00480446');
    expect(invertedValue('0.0000345')).toBe('28985.5');
    expect(invertedValue('2')).toBe('0.5');
  });
});
