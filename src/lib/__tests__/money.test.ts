import * as fc from 'fast-check';

import { CURRENCIES, CURRENCY_CODES, formatMoney, isCurrencyCode, parseAmount, searchCurrencies, toInputString } from '../money';

const anyCurrency = fc.constantFrom(...CURRENCY_CODES);

describe('parseAmount', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['0.05', 5],
    ['.5', 50],
    ['1,234.56', 123456],
    ['£ 7.20', 720],
  ])('reads %p as %p pence', (text, minor) => {
    expect(parseAmount(text, 'GBP')).toBe(minor);
  });

  it('reads yen without decimals', () => {
    expect(parseAmount('96,000', 'JPY')).toBe(96000);
    expect(parseAmount('96000.5', 'JPY')).toBeNull();
  });

  it.each(['', '.', 'abc', '12.345', '1.2.3', '-5', '12e3'])('rejects %p', (text) => {
    expect(parseAmount(text, 'GBP')).toBeNull();
  });

  it('rejects amounts past the limit', () => {
    expect(parseAmount('999999999999', 'GBP')).toBeNull();
  });

  it.each([
    ['12,5', 1250],
    ['12,50', 1250],
    ['€12,50', 1250],
    ['1.234,56', 123456],
    ['1,234', 123400],
    ['1,234,567', 123456700],
    ['12,', 1200],
  ])('reads the decimal comma in %p as %p cents', (text, minor) => {
    expect(parseAmount(text, 'EUR')).toBe(minor);
  });

  it('never reads a comma as a decimal point in a currency without decimals', () => {
    expect(parseAmount('12,5', 'JPY')).toBeNull();
    expect(parseAmount('1,600', 'JPY')).toBe(1600);
  });

  it('accepts a currency code or symbol on either side', () => {
    expect(parseAmount('CHF 30', 'CHF')).toBe(3000);
    expect(parseAmount('30 chf', 'CHF')).toBe(3000);
    expect(parseAmount('NZ$12', 'NZD')).toBe(1200);
    expect(parseAmount('R$ 5,00', 'BRL')).toBe(500);
    expect(parseAmount('₩12,000', 'KRW')).toBe(12000);
  });

  it('round-trips with toInputString in every currency', () => {
    fc.assert(
      fc.property(anyCurrency, fc.integer({ min: 0, max: 10_000_000_000 }), (currency, minor) => {
        expect(parseAmount(toInputString(minor, currency), currency)).toBe(minor);
      })
    );
  });

  it('reads back whatever formatMoney writes, in every currency', () => {
    fc.assert(
      fc.property(anyCurrency, fc.integer({ min: 0, max: 10_000_000_000 }), (currency, minor) => {
        expect(parseAmount(formatMoney(minor, currency), currency)).toBe(minor);
      })
    );
  });
});

describe('the currencies', () => {
  it('starts with the four most groups use, and lists every currency once', () => {
    expect(CURRENCY_CODES.slice(0, 4)).toEqual(['GBP', 'EUR', 'USD', 'JPY']);
    expect(new Set(CURRENCY_CODES).size).toBe(Object.keys(CURRENCIES).length);
  });

  it('gives every currency a symbol and the ISO 4217 decimals', () => {
    for (const code of CURRENCY_CODES) {
      expect(CURRENCIES[code].symbol.trim()).not.toBe('');
      expect([0, 2]).toContain(CURRENCIES[code].decimals);
    }
    expect(CURRENCIES.KRW.decimals).toBe(0);
    expect(CURRENCIES.ISK.decimals).toBe(0);
    expect(CURRENCIES.VND.decimals).toBe(0);
  });

  it('finds currencies by name, code or symbol', () => {
    expect(searchCurrencies('yen')).toEqual(['JPY']);
    expect(searchCurrencies('swiss')).toEqual(['CHF']);
    expect(searchCurrencies('krw')).toEqual(['KRW']);
    expect(searchCurrencies('₩')).toEqual(['KRW']);
    expect(searchCurrencies('dollar')).toEqual(expect.arrayContaining(['USD', 'AUD', 'CAD', 'NZD', 'SGD', 'HKD', 'TWD']));
    expect(searchCurrencies('  ')).toEqual(CURRENCY_CODES);
    expect(searchCurrencies('doubloons')).toEqual([]);
    expect(searchCurrencies('dong')).toEqual(['VND']);
    expect(searchCurrencies('Zloty')).toEqual(['PLN']);
    expect(searchCurrencies('krona')).toEqual(expect.arrayContaining(['ISK', 'SEK']));
  });

  it('knows its own codes', () => {
    expect(isCurrencyCode('JPY')).toBe(true);
    expect(isCurrencyCode('XYZ')).toBe(false);
    expect(isCurrencyCode('toString')).toBe(false);
  });
});

describe('formatMoney', () => {
  it('formats each currency the way people write it', () => {
    expect(formatMoney(123450, 'GBP')).toBe('£1,234.50');
    expect(formatMoney(500, 'USD')).toBe('$5.00');
    expect(formatMoney(1200, 'EUR')).toBe('€12.00');
    expect(formatMoney(96000, 'JPY')).toBe('¥96,000');
  });

  it('writes the same symbols on every platform, never "JP¥" or "US$"', () => {
    expect(formatMoney(102940, 'JPY')).toBe('¥102,940');
    expect(formatMoney(-102940, 'JPY')).toBe('-¥102,940');
    expect(formatMoney(123456789, 'USD')).toBe('$1,234,567.89');
    expect(formatMoney(5, 'EUR')).toBe('€0.05');
  });

  it('writes letter symbols with a space, and symbols without', () => {
    expect(formatMoney(1200, 'CHF')).toBe('CHF 12.00');
    expect(formatMoney(12000, 'KRW')).toBe('₩12,000');
    expect(formatMoney(1500, 'ISK')).toBe('ISK 1,500');
    expect(formatMoney(-990, 'NZD')).toBe('-NZ$9.90');
  });

  it('can sign gains and losses', () => {
    expect(formatMoney(2500, 'GBP', { signed: true })).toBe('+£25.00');
    expect(formatMoney(-2500, 'GBP', { signed: true })).toBe('-£25.00');
    expect(formatMoney(0, 'GBP', { signed: true })).toBe('£0.00');
  });
});
