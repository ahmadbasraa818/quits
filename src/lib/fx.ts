import { CURRENCIES, CurrencyCode, formatMoney } from './money';

/**
 * An exchange rate: one unit of `base` buys `value` of the other currency.
 * The value is an exact decimal string ("208.14"), never a float, and is
 * kept the way round that reads as a number above one, so a pound in yen
 * is "£1 = ¥208.14", not "¥1 = £0.0048".
 */
export type Rate = { base: CurrencyCode; value: string };

/** The longest rate Quits keeps: nine whole digits and ten decimals. */
const RATE = /^(\d{1,9})(?:\.(\d{1,10}))?$/;

/**
 * Reads a typed rate ("208.14", " 0.0048 ", "33,000", "1,1667") as a canonical
 * decimal, or null if it isn't a positive number. Commas follow the rule
 * amounts do: a comma before exactly three digits groups thousands, so
 * "33,000" is thirty-three thousand; any other single comma is a decimal
 * point, so "1,1667" is 1.1667.
 */
export function parseRateValue(text: string): string | null {
  let plain = text.trim();
  if (plain.includes(',') && plain.includes('.')) plain = plain.lastIndexOf(',') > plain.lastIndexOf('.') ? plain.replace(/\./g, '').replace(',', '.') : plain.replace(/,/g, '');
  else if (/,\d{3}(?!\d)/.test(plain)) plain = /^\d{1,3}(,\d{3})+$/.test(plain) ? plain.replace(/,/g, '') : '';
  else plain = plain.replace(',', '.');
  const match = RATE.exec(plain);
  if (!match) return null;
  const whole = match[1].replace(/^0+(?=\d)/, '');
  const fraction = (match[2] ?? '').replace(/0+$/, '');
  if (/^0*$/.test(whole + fraction)) return null;
  return fraction ? `${whole}.${fraction}` : whole;
}

/** "208.14" as the fraction 20814 / 100. */
function asFraction(value: string): [bigint, bigint] {
  const [whole, decimals = ''] = value.split('.');
  return [BigInt(whole + decimals), 10n ** BigInt(decimals.length)];
}

/** numerator / denominator, rounded half up. Both are positive. */
function divideRounded(numerator: bigint, denominator: bigint): bigint {
  return (2n * numerator + denominator) / (2n * denominator);
}

/**
 * Converts `amount` minor units of `from` into minor units of `to`. The
 * arithmetic is exact, in whole numbers, with one rounding at the end, half
 * up: £12.34 at £1 = ¥208.14 is exactly ¥2,568.4476, so ¥2,568.
 */
export function convert(amount: number, from: CurrencyCode, to: CurrencyCode, rate: Rate): number {
  if (from === to) return amount;
  if (rate.base !== from && rate.base !== to) throw new Error(`A ${rate.base} rate can't convert ${from} to ${to}`);
  const [units, scale] = asFraction(rate.value);
  const fromMinor = 10n ** BigInt(CURRENCIES[from].decimals);
  const toMinor = 10n ** BigInt(CURRENCIES[to].decimals);
  const value = BigInt(amount);
  const result = rate.base === from ? divideRounded(value * units * toMinor, scale * fromMinor) : divideRounded(value * scale * toMinor, units * fromMinor);
  return Number(result);
}

/** The other currency in a rate between `a` and `b`. */
export function quoteOf(rate: Rate, a: CurrencyCode, b: CurrencyCode): CurrencyCode {
  return rate.base === a ? b : a;
}

/** "£1 = ¥208.14": the base's symbol, then the rate with as many decimals as it has. */
export function describeRate(rate: Rate, quote: CurrencyCode): string {
  const [whole, decimals = ''] = rate.value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${formatMoney(10 ** CURRENCIES[rate.base].decimals, rate.base).replace(/\.0+$/, '')} = ${CURRENCIES[quote].symbol}${grouped}${decimals ? `.${decimals}` : ''}`;
}

/**
 * The same rate read the other way round, to `digits` significant figures,
 * as a starting point when someone flips a rate to type it in. Rates are
 * always stored exactly as given; this is never used to convert.
 */
export function invertedValue(value: string, digits = 6): string {
  const inverse = 1 / Number(value);
  const decimals = Math.min(10, Math.max(0, digits - 1 - Math.floor(Math.log10(inverse))));
  return parseRateValue(inverse.toFixed(decimals)) ?? '0';
}
