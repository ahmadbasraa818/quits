const pad = (value: number) => String(value).padStart(2, '0');

/** A date as YYYY-MM-DD in local time (not UTC, which can be a day out near midnight). */
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The calendar date `days` before `now`. */
export function daysAgo(days: number, now = new Date()): string {
  return localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
}

/** A YYYY-MM-DD date as local midnight. */
export function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return localDate(parseLocalDate(date)) === date;
}

/** The date `days` after `date` (or before, when negative). */
export function addDays(date: string, days: number): string {
  const d = parseLocalDate(date);
  return localDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

// Written out here rather than left to Intl, which puts commas and abbreviations
// in different places on each platform ("Wed, 24 Dec" on one, "Wed 24 Dec" on another).
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Today", "Yesterday", "Fri 2 Oct", or "Fri 2 Oct 2025" outside this year. */
export function dayLabel(date: string, now = new Date()): string {
  if (date === daysAgo(0, now)) return 'Today';
  if (date === daysAgo(1, now)) return 'Yesterday';
  if (date === daysAgo(-1, now)) return 'Tomorrow';
  const parsed = parseLocalDate(date);
  const label = `${DAYS[parsed.getDay()].slice(0, 3)} ${parsed.getDate()} ${MONTHS[parsed.getMonth()].slice(0, 3)}`;
  return parsed.getFullYear() === now.getFullYear() ? label : `${label} ${parsed.getFullYear()}`;
}

/** How long ago something happened, by the calendar: "today", "yesterday", "3 days ago". */
export function agoLabel(at: number, now = new Date()): string {
  const then = new Date(at);
  const days = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())) / 86_400_000);
  if (days <= 0) return 'today';
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** "Friday 2 October 2026", for screen readers. */
export function longDateLabel(date: string): string {
  const parsed = parseLocalDate(date);
  return `${DAYS[parsed.getDay()]} ${parsed.getDate()} ${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

/** "October 2026". `month` counts from 0, as in Date. */
export function monthLabel(year: number, month: number): string {
  const first = new Date(year, month, 1);
  return `${MONTHS[first.getMonth()]} ${first.getFullYear()}`;
}

/**
 * The weeks of a month as rows of seven, Monday first, with null for the
 * days that belong to the months either side.
 */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = [...Array<null>(lead).fill(null)];
  for (let day = 1; day <= days; day += 1) cells.push(localDate(new Date(year, month, day)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

/** The initials of the week, Monday first. */
export const WEEKDAYS = [
  { short: 'M', long: 'Monday' },
  { short: 'T', long: 'Tuesday' },
  { short: 'W', long: 'Wednesday' },
  { short: 'T', long: 'Thursday' },
  { short: 'F', long: 'Friday' },
  { short: 'S', long: 'Saturday' },
  { short: 'S', long: 'Sunday' },
] as const;
