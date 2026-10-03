import * as fc from 'fast-check';

import { allocate, participantsOf, sharesOf, splitProblem } from '../split';

describe('allocate', () => {
  it('splits £10 three ways into whole pence that add up', () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
  });

  it('follows the weights', () => {
    expect(allocate(1000, [2, 1, 1])).toEqual([500, 250, 250]);
    expect(allocate(100, [1, 0, 1])).toEqual([50, 0, 50]);
  });

  it('always adds up exactly, and never strays a unit from the fair share', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.array(fc.integer({ min: 0, max: 50 }), { minLength: 1, maxLength: 12 }).filter((w) => w.some((x) => x > 0)),
        (total, weights) => {
          const parts = allocate(total, weights);
          const sum = weights.reduce((a, b) => a + b, 0);
          expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
          parts.forEach((part, i) => {
            const fair = (total * weights[i]) / sum;
            expect(part).toBeGreaterThanOrEqual(Math.floor(fair));
            expect(part).toBeLessThanOrEqual(Math.ceil(fair));
          });
        }
      )
    );
  });

  it('refuses weights that are all zero', () => {
    expect(() => allocate(100, [0, 0])).toThrow();
  });
});

describe('sharesOf', () => {
  it('splits equally', () => {
    expect(sharesOf(1000, { kind: 'equal', among: ['a', 'b', 'c'] })).toEqual({ a: 334, b: 333, c: 333 });
  });

  it('splits by shares, leaving out anyone with none', () => {
    expect(sharesOf(9000, { kind: 'shares', shares: { a: 2, b: 1, c: 0 } })).toEqual({ a: 6000, b: 3000 });
  });

  it('keeps exact amounts as given', () => {
    expect(sharesOf(1500, { kind: 'exact', amounts: { a: 1000, b: 500, c: 0 } })).toEqual({ a: 1000, b: 500 });
    expect(participantsOf({ kind: 'exact', amounts: { a: 1000, b: 500, c: 0 } })).toEqual(['a', 'b']);
  });
});

describe('splitProblem', () => {
  it('passes a sound split', () => {
    expect(splitProblem(1000, { kind: 'equal', among: ['a'] }, 'GBP')).toBeNull();
  });

  it('explains what is wrong', () => {
    expect(splitProblem(0, { kind: 'equal', among: ['a'] }, 'GBP')).toBe('Enter an amount above zero.');
    expect(splitProblem(1000, { kind: 'equal', among: [] }, 'GBP')).toBe('Choose at least one person to split with.');
    expect(splitProblem(1000, { kind: 'shares', shares: { a: 1.5 } }, 'GBP')).toBe('Shares must be whole numbers.');
    expect(splitProblem(1000, { kind: 'exact', amounts: { a: 600 } }, 'GBP')).toBe('£4.00 still to assign.');
    expect(splitProblem(1000, { kind: 'exact', amounts: { a: 600, b: 500 } }, 'GBP')).toBe('£1.00 over the total.');
  });
});
