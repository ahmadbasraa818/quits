import { CURRENCIES, CurrencyCode, MAX_AMOUNT, parseAmount } from './money';

/** An exact fraction, numerator over a positive denominator. */
type Fraction = { n: bigint; d: bigint };

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const make = (n: bigint, d: bigint): Fraction => {
  const sign = d < 0n ? -1n : 1n;
  const g = gcd(n, d) || 1n;
  return { n: (sign * n) / g, d: (sign * d) / g };
};
const add = (a: Fraction, b: Fraction) => make(a.n * b.d + b.n * a.d, a.d * b.d);
const subtract = (a: Fraction, b: Fraction) => make(a.n * b.d - b.n * a.d, a.d * b.d);
const multiply = (a: Fraction, b: Fraction) => make(a.n * b.n, a.d * b.d);
const divide = (a: Fraction, b: Fraction) => (b.n === 0n ? null : make(a.n * b.d, a.d * b.n));

/** Whether what was typed is a sum to work out rather than a plain amount. */
export function isSum(text: string): boolean {
  return /\d\s*[-+*/×÷x]\s*[\d.(]/.test(text) || /[()]/.test(text);
}

/**
 * Works out a sum typed into an amount field, "4800/3" or "12.50 + 3.20 × 2",
 * in exact fractions, with multiplication before addition, and brackets.
 * The answer is rounded once, half up, to the currency's smallest unit.
 * Returns null for anything that isn't a sum of numbers, a negative answer,
 * or division by zero.
 */
export function evaluateSum(text: string, currency: CurrencyCode): number | null {
  const tokens = text.replace(/\s+/g, '').match(/\d[\d,]*(?:\.\d+)?|\.\d+|[-+*/×÷x()]/g);
  if (!tokens || tokens.join('') !== text.replace(/\s+/g, '')) return null;
  let position = 0;
  const peek = () => tokens[position];

  // A number keeps all the decimals typed; rounding to pennies waits for the answer.
  const number = (token: string): Fraction | null => {
    const plain = token.replace(/,/g, '');
    if (!/^\d*\.?\d+$/.test(plain)) return null;
    const [whole, fraction = ''] = plain.split('.');
    return make(BigInt(`${whole || '0'}${fraction}`), 10n ** BigInt(fraction.length));
  };
  const factor = (): Fraction | null => {
    const token = peek();
    if (token === undefined) return null;
    position += 1;
    if (token === '(') {
      const inner = expression();
      if (peek() !== ')') return null;
      position += 1;
      return inner;
    }
    return number(token);
  };
  const term = (): Fraction | null => {
    let value = factor();
    while (value && ['*', '×', 'x', '/', '÷'].includes(peek() ?? '')) {
      const operator = tokens[position++];
      const right = factor();
      if (!right) return null;
      value = operator === '/' || operator === '÷' ? divide(value, right) : multiply(value, right);
    }
    return value;
  };
  const expression = (): Fraction | null => {
    let value = term();
    while (value && (peek() === '+' || peek() === '-')) {
      const operator = tokens[position++];
      const right = term();
      if (!right) return null;
      value = operator === '+' ? add(value, right) : subtract(value, right);
    }
    return value;
  };

  const result = expression();
  if (!result || position !== tokens.length || result.n < 0n) return null;
  const minor = make(result.n * 10n ** BigInt(CURRENCIES[currency].decimals), result.d);
  const rounded = Number((2n * minor.n + minor.d) / (2n * minor.d));
  return rounded <= MAX_AMOUNT ? rounded : null;
}

/** An amount typed into a field: a plain amount, or a sum to work out. */
export function readAmount(text: string, currency: CurrencyCode): number | null {
  return isSum(text) ? evaluateSum(text, currency) : parseAmount(text, currency);
}
