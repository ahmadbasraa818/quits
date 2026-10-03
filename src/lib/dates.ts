const pad = (value: number) => String(value).padStart(2, '0');

/** A date as YYYY-MM-DD in local time (not UTC, which can be a day out near midnight). */
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The calendar date `days` before `now`. */
export function daysAgo(days: number, now = new Date()): string {
  return localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
}
