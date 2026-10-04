import * as fc from 'fast-check';

import { evaluateSum, isSum, readAmount } from '../calc';
import { toInputString } from '../money';

describe('sums in amount fields', () => {
  it.each([
    ['4800/3', 'JPY', 1600],
    ['1200+350', 'JPY', 1550],
    ['12.50 + 3.20 × 2', 'GBP', 1890],
    ['(12.50 + 3.20) * 2', 'GBP', 3140],
    ['100/3', 'GBP', 3333],
    ['200/3', 'GBP', 6667],
    ['10 - 2.5', 'EUR', 750],
    ['1,200x3', 'JPY', 3600],
    ['7 ÷ 2', 'JPY', 4],
    ['.5+.25', 'USD', 75],
  ])('works out %p in %s as %p', (text, currency, minor) => {
    expect(evaluateSum(text, currency as 'GBP')).toBe(minor);
  });

  it.each(['5/0', '2-3', '4*', '(1+2', '1+2)', 'abc', '1++2', '£5+2'])('refuses %p', (text) => {
    expect(evaluateSum(text, 'GBP')).toBeNull();
  });

  it('tells a sum from a plain amount', () => {
    expect(isSum('4800/3')).toBe(true);
    expect(isSum('12.50')).toBe(false);
    expect(isSum('1,200')).toBe(false);
    expect(readAmount('12.50', 'GBP')).toBe(1250);
    expect(readAmount('12,50', 'EUR')).toBe(1250);
    expect(readAmount('4800/3', 'JPY')).toBe(1600);
  });

  it('adds exactly, with no floating-point drift', () => {
    // 0.1 + 0.2 is 0.30000000000000004 in floating point.
    expect(evaluateSum('0.1+0.2', 'GBP')).toBe(30);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000_000 }), fc.integer({ min: 0, max: 100_000_000 }), (a, b) => {
        expect(evaluateSum(`${toInputString(a, 'GBP')}+${toInputString(b, 'GBP')}`, 'GBP')).toBe(a + b);
      })
    );
  });

  it('splits a total n ways to the nearest penny', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000_000 }), fc.integer({ min: 1, max: 30 }), (total, ways) => {
        const share = evaluateSum(`${toInputString(total, 'GBP')}/${ways}`, 'GBP')!;
        expect(Math.abs(share * ways - total)).toBeLessThanOrEqual(ways / 2);
      })
    );
  });
});
