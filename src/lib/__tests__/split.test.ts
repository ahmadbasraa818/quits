import * as fc from 'fast-check';

import { convert, Rate } from '../fx';
import { allocate, expenseShares, itemSubtotals, itemsTotal, participantsOf, sharesOf, Split, splitProblem } from '../split';

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

  it('stays exact when total × weight passes 2^53', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000_000 }),
        fc.array(fc.integer({ min: 0, max: 10_000_000_000 }), { minLength: 1, maxLength: 8 }).filter((w) => w.some((x) => x > 0)),
        (total, weights) => {
          const parts = allocate(total, weights);
          const sum = BigInt(weights.reduce((a, b) => a + b, 0));
          expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
          parts.forEach((part, i) => {
            const product = BigInt(total) * BigInt(weights[i]);
            const floor = Number(product / sum);
            expect(part).toBeGreaterThanOrEqual(floor);
            expect(part).toBeLessThanOrEqual(floor + (product % sum === 0n ? 0 : 1));
          });
        }
      )
    );
    expect(allocate(10_000_000_000, [3_333_333_333, 3_333_333_333, 3_333_333_334])).toEqual([3_333_333_333, 3_333_333_333, 3_333_333_334]);
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

describe('expenseShares', () => {
  const yen: Rate = { base: 'GBP', value: '208.14' };

  it('uses the split as it is when the expense is in the group’s currency', () => {
    expect(expenseShares({ amount: 900, split: { kind: 'equal', among: ['a', 'b', 'c'] } })).toEqual({ a: 300, b: 300, c: 300 });
  });

  it('divides the converted total in the proportions of the original split', () => {
    // ¥9,000 split ¥6,000 / ¥3,000, paid in yen by a pound group: £43.24 at £1 = ¥208.14.
    const amount = convert(9000, 'JPY', 'GBP', yen);
    expect(amount).toBe(4324);
    const shares = expenseShares({ amount, original: { amount: 9000, currency: 'JPY', rate: yen }, split: { kind: 'exact', amounts: { a: 6000, b: 3000 } } });
    expect(shares).toEqual({ a: 2883, b: 1441 });
  });

  it('always adds up to the converted amount, within a unit of each fair share', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5_000_000 }),
        fc.integer({ min: 1, max: 900_000 }).map((n) => String(n / 1000)),
        fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 2, maxLength: 8 }).filter((w) => w.some((x) => x > 0)),
        (paid, value, weights) => {
          const rate: Rate = { base: 'JPY', value };
          const amount = convert(paid, 'JPY', 'EUR', rate);
          const ids = weights.map((_, i) => `p${i}`);
          const split = { kind: 'shares' as const, shares: Object.fromEntries(ids.map((id, i) => [id, weights[i]])) };
          const shares = expenseShares({ amount, original: { amount: paid, currency: 'JPY', rate }, split });
          expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(amount);
          const inYen = sharesOf(paid, split);
          for (const id of Object.keys(shares)) {
            // The fair share, worked out exactly: amount × share ÷ paid lies between floor and ceiling.
            const product = BigInt(amount) * BigInt(inYen[id]);
            const floor = Number(product / BigInt(paid));
            expect(shares[id]).toBeGreaterThanOrEqual(floor);
            expect(shares[id]).toBeLessThanOrEqual(floor + (product % BigInt(paid) === 0n ? 0 : 1));
          }
        }
      )
    );
  });
});

describe('itemised bills', () => {
  const bill: Extract<Split, { kind: 'items' }> = {
    kind: 'items',
    items: [
      { id: '1', label: 'Pork okonomiyaki', amount: 1450, among: ['you'] },
      { id: '2', label: 'Yakisoba to share', amount: 1200, among: ['you', 'aiko', 'ben'] },
      { id: '3', label: 'Beers', amount: 2400, among: ['aiko', 'ben'] },
    ],
    extras: 0,
  };

  it('splits each item between whoever had it', () => {
    expect(itemSubtotals(bill.items)).toEqual({ you: 1850, aiko: 1600, ben: 1600 });
    expect(itemsTotal(bill)).toBe(5050);
    expect(sharesOf(5050, bill)).toEqual({ you: 1850, aiko: 1600, ben: 1600 });
    expect(participantsOf(bill).sort()).toEqual(['aiko', 'ben', 'you']);
  });

  it('shares tax, service and tip in proportion to what everyone had', () => {
    // £30 of food (£20 and £10), plus £6 service: £24 and £12.
    const withService: Split = { kind: 'items', items: [{ id: 'a', label: 'Steak', amount: 2000, among: ['a'] }, { id: 'b', label: 'Salad', amount: 1000, among: ['b'] }], extras: 600 };
    expect(sharesOf(3600, withService)).toEqual({ a: 2400, b: 1200 });
  });

  it('says what’s missing', () => {
    expect(splitProblem(0, { kind: 'items', items: [], extras: 0 }, 'GBP')).toBe('Add an item with its price.');
    expect(splitProblem(500, { kind: 'items', items: [{ id: '1', label: 'Chips', amount: 500, among: [] }], extras: 0 }, 'GBP')).toBe('Say who had “Chips”.');
    expect(splitProblem(500, { kind: 'items', items: [{ id: '1', label: '', amount: 500, among: [] }], extras: 0 }, 'GBP')).toBe('Say who had each item.');
    expect(splitProblem(9999, bill, 'JPY')).toBe('The items come to ¥5,050, not ¥9,999.');
    expect(splitProblem(5050, bill, 'JPY')).toBeNull();
  });

  it('always adds up, extras and all', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ amount: fc.integer({ min: 0, max: 100_000 }), among: fc.subarray(['a', 'b', 'c', 'd'], { minLength: 1 }) }), { minLength: 1, maxLength: 8 }),
        fc.integer({ min: 0, max: 50_000 }),
        (lines, extras) => {
          const split: Extract<Split, { kind: 'items' }> = { kind: 'items', items: lines.map((line, i) => ({ id: String(i), label: 'x', ...line })), extras };
          const total = itemsTotal(split);
          fc.pre(lines.some((line) => line.amount > 0));
          const shares = sharesOf(total, split);
          expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(total);
          // Nobody who had nothing pays anything.
          const subtotals = itemSubtotals(split.items);
          for (const id of Object.keys(shares)) expect(subtotals[id]).toBeGreaterThan(0);
        }
      )
    );
  });
});
