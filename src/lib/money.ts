/**
 * Money is held as whole minor units (pence, cents, yen) in plain integers,
 * so adding up a trip's worth of expenses never picks up floating-point error.
 */

type CurrencyInfo = {
  name: string;
  /** For "amount in Japanese yen", "how many euros": never just name + "s". */
  plural: string;
  /** Written before the number. Letters get a trailing space: "CHF 12.00". */
  symbol: string;
  /** Digits after the decimal point, from ISO 4217: 2 for pounds, 0 for yen. */
  decimals: number;
  /** The European Central Bank publishes a daily rate for it, so rates can be looked up. */
  liveRate: boolean;
};

export const CURRENCIES = {
  GBP: { name: 'British pound', plural: 'British pounds', symbol: '£', decimals: 2, liveRate: true },
  EUR: { name: 'Euro', plural: 'euros', symbol: '€', decimals: 2, liveRate: true },
  USD: { name: 'US dollar', plural: 'US dollars', symbol: '$', decimals: 2, liveRate: true },
  JPY: { name: 'Japanese yen', plural: 'Japanese yen', symbol: '¥', decimals: 0, liveRate: true },
  AUD: { name: 'Australian dollar', plural: 'Australian dollars', symbol: 'A$', decimals: 2, liveRate: true },
  BRL: { name: 'Brazilian real', plural: 'Brazilian reais', symbol: 'R$', decimals: 2, liveRate: true },
  CAD: { name: 'Canadian dollar', plural: 'Canadian dollars', symbol: 'C$', decimals: 2, liveRate: true },
  CHF: { name: 'Swiss franc', plural: 'Swiss francs', symbol: 'CHF ', decimals: 2, liveRate: true },
  CNY: { name: 'Chinese yuan', plural: 'Chinese yuan', symbol: 'CN¥', decimals: 2, liveRate: true },
  CZK: { name: 'Czech koruna', plural: 'Czech korunas', symbol: 'CZK ', decimals: 2, liveRate: true },
  DKK: { name: 'Danish krone', plural: 'Danish kroner', symbol: 'DKK ', decimals: 2, liveRate: true },
  HKD: { name: 'Hong Kong dollar', plural: 'Hong Kong dollars', symbol: 'HK$', decimals: 2, liveRate: true },
  HUF: { name: 'Hungarian forint', plural: 'Hungarian forints', symbol: 'HUF ', decimals: 2, liveRate: true },
  IDR: { name: 'Indonesian rupiah', plural: 'Indonesian rupiah', symbol: 'IDR ', decimals: 2, liveRate: true },
  ILS: { name: 'Israeli shekel', plural: 'Israeli shekels', symbol: '₪', decimals: 2, liveRate: true },
  INR: { name: 'Indian rupee', plural: 'Indian rupees', symbol: '₹', decimals: 2, liveRate: true },
  ISK: { name: 'Icelandic króna', plural: 'Icelandic krónur', symbol: 'ISK ', decimals: 0, liveRate: true },
  KRW: { name: 'South Korean won', plural: 'South Korean won', symbol: '₩', decimals: 0, liveRate: true },
  MXN: { name: 'Mexican peso', plural: 'Mexican pesos', symbol: 'MX$', decimals: 2, liveRate: true },
  MYR: { name: 'Malaysian ringgit', plural: 'Malaysian ringgit', symbol: 'RM', decimals: 2, liveRate: true },
  NOK: { name: 'Norwegian krone', plural: 'Norwegian kroner', symbol: 'NOK ', decimals: 2, liveRate: true },
  NZD: { name: 'New Zealand dollar', plural: 'New Zealand dollars', symbol: 'NZ$', decimals: 2, liveRate: true },
  PHP: { name: 'Philippine peso', plural: 'Philippine pesos', symbol: '₱', decimals: 2, liveRate: true },
  PLN: { name: 'Polish złoty', plural: 'Polish złoty', symbol: 'PLN ', decimals: 2, liveRate: true },
  RON: { name: 'Romanian leu', plural: 'Romanian lei', symbol: 'RON ', decimals: 2, liveRate: true },
  SEK: { name: 'Swedish krona', plural: 'Swedish kronor', symbol: 'SEK ', decimals: 2, liveRate: true },
  SGD: { name: 'Singapore dollar', plural: 'Singapore dollars', symbol: 'S$', decimals: 2, liveRate: true },
  THB: { name: 'Thai baht', plural: 'Thai baht', symbol: '฿', decimals: 2, liveRate: true },
  TRY: { name: 'Turkish lira', plural: 'Turkish lira', symbol: '₺', decimals: 2, liveRate: true },
  ZAR: { name: 'South African rand', plural: 'South African rand', symbol: 'R', decimals: 2, liveRate: true },
  AED: { name: 'UAE dirham', plural: 'UAE dirhams', symbol: 'AED ', decimals: 2, liveRate: false },
  TWD: { name: 'New Taiwan dollar', plural: 'New Taiwan dollars', symbol: 'NT$', decimals: 2, liveRate: false },
  VND: { name: 'Vietnamese đồng', plural: 'Vietnamese đồng', symbol: '₫', decimals: 0, liveRate: false },
} as const satisfies Record<string, CurrencyInfo>;

export type CurrencyCode = keyof typeof CURRENCIES;

/** The four most groups use first, then the rest by name. */
const POPULAR: CurrencyCode[] = ['GBP', 'EUR', 'USD', 'JPY'];
export const CURRENCY_CODES: CurrencyCode[] = [
  ...POPULAR,
  ...(Object.keys(CURRENCIES) as CurrencyCode[])
    .filter((code) => !POPULAR.includes(code))
    .sort((a, b) => CURRENCIES[a].name.localeCompare(CURRENCIES[b].name)),
];

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

/** Lower case without accents, so "dong" finds the đồng and "zloty" the złoty. */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/ł/g, 'l')
    .toLowerCase();

/** Currencies whose code or name contains what someone typed, or whose symbol it is. */
export function searchCurrencies(query: string): CurrencyCode[] {
  const wanted = fold(query.trim());
  if (wanted === '') return CURRENCY_CODES;
  return CURRENCY_CODES.filter((code) => {
    const { name, symbol } = CURRENCIES[code];
    return code.toLowerCase().includes(wanted) || fold(name).includes(wanted) || fold(symbol.trim()) === wanted;
  });
}

/** The largest amount the app accepts, in minor units: comfortably inside exact integer range. */
export const MAX_AMOUNT = 10_000_000_000;

// Every symbol and code, longest first, so "NZ$" is recognised before "$".
const TOKENS = [...new Set(Object.entries(CURRENCIES).flatMap(([code, { symbol }]) => [code, symbol.trim()]))].sort((a, b) => b.length - a.length);

/** Drops one currency symbol or code from the start and one from the end, if present. */
function stripCurrency(text: string): string {
  let rest = text;
  const start = TOKENS.find((token) => rest.toLowerCase().startsWith(token.toLowerCase()));
  if (start) rest = rest.slice(start.length);
  const end = TOKENS.find((token) => rest.toLowerCase().endsWith(token.toLowerCase()));
  if (end) rest = rest.slice(0, rest.length - end.length);
  return rest;
}

/**
 * Parses what someone typed into minor units: "12", "12.5", "1,234.50", "£12",
 * "CHF 30", and the decimal comma many people use, "12,50". A single comma
 * followed by one or two digits is a decimal point; otherwise commas group
 * thousands. Returns null for anything that is not a plain amount, or that has
 * more decimal places than the currency uses.
 */
export function parseAmount(text: string, currency: CurrencyCode): number | null {
  const { decimals } = CURRENCIES[currency];
  const compact = stripCurrency(text.replace(/\s/g, ''));
  const lastDot = compact.lastIndexOf('.');
  const lastComma = compact.lastIndexOf(',');
  const afterComma = compact.length - lastComma - 1;
  let decimalMark: '.' | ',' = '.';
  if (lastComma > lastDot && (lastDot >= 0 || (compact.indexOf(',') === lastComma && afterComma >= 1 && afterComma <= 2))) {
    decimalMark = ',';
  }
  const grouping = decimalMark === ',' ? '.' : ',';
  const plain = compact.split(grouping).join('').replace(decimalMark, '.');
  const match = /^(\d*)(?:\.(\d*))?$/.exec(plain);
  if (!match || plain === '' || plain === '.') return null;
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
 * "£1,234.50", "¥96,000", "CHF 5.00". With `signed`, gains get a plus sign.
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
