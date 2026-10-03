/**
 * Money is held as whole minor units (pence, cents, yen) in plain integers,
 * so adding up a trip's worth of expenses never picks up floating-point error.
 */

export type CurrencyCode = 'GBP' | 'EUR' | 'USD' | 'JPY';

export const CURRENCIES: Record<CurrencyCode, { name: string; symbol: string; decimals: number }> = {
  GBP: { name: 'British pound', symbol: '£', decimals: 2 },
  EUR: { name: 'Euro', symbol: '€', decimals: 2 },
  USD: { name: 'US dollar', symbol: '$', decimals: 2 },
  JPY: { name: 'Japanese yen', symbol: '¥', decimals: 0 },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

/** The largest amount the app accepts, in minor units: comfortably inside exact integer range. */
export const MAX_AMOUNT = 10_000_000_000;

/**
 * Parses what someone typed ("12", "12.5", "1,234.50", "£12") into minor units.
 * Returns null for anything that is not a plain amount, or that has more
 * decimal places than the currency uses.
 */
export function parseAmount(text: string, currency: CurrencyCode): number | null {
  const { decimals } = CURRENCIES[currency];
  const cleaned = text.replace(/[\s,£€$¥]/g, '');
  const match = /^(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match || cleaned === '' || cleaned === '.') return null;
  const [, whole = '', fraction = ''] = match;
  if (fraction.length > decimals) return null;
  const digits = `${whole || '0'}${fraction.padEnd(decimals, '0')}`;
  const minor = Number(digits);
  if (!Number.isSafeInteger(minor) || minor > MAX_AMOUNT) return null;
  return minor;
}

/** Minor units as the plain decimal a person would type: 1250 -> "12.50", ¥1200 -> "1200". */
export function toInputString(minor: number, currency: CurrencyCode): string {
  const { decimals } = CURRENCIES[currency];
  if (decimals === 0) return String(minor);
  const sign = minor < 0 ? '-' : '';
  const digits = String(Math.abs(minor)).padStart(decimals + 1, '0');
  return `${sign}${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
}

const formatters = new Map<number, Intl.NumberFormat>();

/**
 * "£1,234.50", "¥96,000", "$5.00". With `signed`, gains get a plus sign.
 *
 * The number comes from Intl, for its grouping, but the symbol is the app's
 * own: iOS ignores Intl's narrow symbols and writes "JP¥" and "US$", so
 * leaving it to the platform would print different money on each one.
 */
export function formatMoney(minor: number, currency: CurrencyCode, { signed = false } = {}): string {
  const { decimals, symbol } = CURRENCIES[currency];
  let formatter = formatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    formatters.set(decimals, formatter);
  }
  const sign = minor < 0 ? '-' : signed && minor > 0 ? '+' : '';
  return `${sign}${symbol}${formatter.format(Math.abs(minor) / 10 ** decimals)}`;
}
