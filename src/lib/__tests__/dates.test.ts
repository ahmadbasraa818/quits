import * as fc from 'fast-check';

import { addDays, dayLabel, daysAgo, isValidDate, localDate, longDateLabel, monthGrid, monthLabel, parseLocalDate } from '../dates';

const now = new Date(2026, 9, 4, 13, 30);

describe('dates', () => {
  it('names the nearest days, and writes the rest briefly', () => {
    expect(dayLabel('2026-10-04', now)).toBe('Today');
    expect(dayLabel('2026-10-03', now)).toBe('Yesterday');
    expect(dayLabel('2026-10-05', now)).toBe('Tomorrow');
    expect(dayLabel('2026-09-28', now)).toBe('Mon 28 Sep');
    expect(dayLabel('2025-12-24', now)).toBe('Wed 24 Dec 2025');
  });

  it('writes the full date for screen readers', () => {
    expect(longDateLabel('2026-11-21')).toBe('Saturday 21 November 2026');
    expect(monthLabel(2026, 10)).toBe('November 2026');
  });

  it('counts days across months and years', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysAgo(4, now)).toBe('2026-09-30');
  });

  it('round-trips a date through local midnight', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 365 * 30 }), (offset) => {
        const date = addDays('2010-01-01', offset);
        expect(localDate(parseLocalDate(date))).toBe(date);
        expect(addDays(addDays(date, 17), -17)).toBe(date);
      })
    );
  });

  it('accepts only real calendar dates', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('21/11/2026')).toBe(false);
  });

  it('lays a month out in weeks, Monday first', () => {
    // October 2026 starts on a Thursday and has 31 days.
    const weeks = monthGrid(2026, 9);
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weeks[weeks.length - 1]).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it('puts every day of any month in the right weekday column', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1990, max: 2090 }), fc.integer({ min: 0, max: 11 }), (year, month) => {
        const weeks = monthGrid(year, month);
        expect(weeks.every((week) => week.length === 7)).toBe(true);
        weeks.forEach((week) =>
          week.forEach((date, column) => {
            if (date) expect((parseLocalDate(date).getDay() + 6) % 7).toBe(column);
          })
        );
        expect(weeks.flat().filter(Boolean)).toHaveLength(new Date(year, month + 1, 0).getDate());
      })
    );
  });
});
