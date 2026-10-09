import * as fc from 'fast-check';

import type { CurrencyCode } from '../money';
import { asksForAmount, describePay, isPayMethod, PAY_KINDS, type PayKind, parsePayMethod, payUrl, samePay } from '../pay';

const ben = (kind: PayKind) => ({ kind, handle: 'ben' });
const request = (amount: number, currency: CurrencyCode, note = 'Japan trip') => ({ amount, currency, note });

describe('reading a way to pay', () => {
  it('takes a username however it’s written', () => {
    expect(parsePayMethod('paypal', ' ben ')).toEqual({ kind: 'paypal', handle: 'ben' });
    expect(parsePayMethod('venmo', '@Ben-Smith')).toEqual({ kind: 'venmo', handle: 'Ben-Smith' });
    expect(parsePayMethod('cashapp', '$ben')).toEqual({ kind: 'cashapp', handle: 'ben' });
    expect(parsePayMethod('revolut', 'ben.smith_1')).toEqual({ kind: 'revolut', handle: 'ben.smith_1' });
  });

  it('takes the username out of a pasted link', () => {
    expect(parsePayMethod('paypal', 'https://www.paypal.me/ben/25GBP')?.handle).toBe('ben');
    expect(parsePayMethod('paypal', 'https://www.paypal.com/paypalme/ben')?.handle).toBe('ben');
    expect(parsePayMethod('monzo', 'monzo.me/ben/12.50?d=Pizza')?.handle).toBe('ben');
    expect(parsePayMethod('revolut', 'https://revolut.me/ben123')?.handle).toBe('ben123');
    expect(parsePayMethod('venmo', 'https://account.venmo.com/u/Ben-Smith')?.handle).toBe('Ben-Smith');
    expect(parsePayMethod('venmo', 'venmo.com/u/ben')?.handle).toBe('ben');
    expect(parsePayMethod('venmo', 'venmo.com/ben?txn=pay&amount=5')?.handle).toBe('ben');
    expect(parsePayMethod('cashapp', 'https://cash.app/$ben/25')?.handle).toBe('ben');
  });

  it('refuses what isn’t a username', () => {
    for (const text of ['', ' ', 'two words', 'ben/extra', '../ben', 'javascript:alert(1)', '-ben', '@', 'a'.repeat(41)]) {
      expect(parsePayMethod('paypal', text)).toBeNull();
    }
  });

  it('refuses a link to another service, or its address alone', () => {
    expect(parsePayMethod('monzo', 'https://paypal.me/ben')).toBeNull();
    expect(parsePayMethod('paypal', 'monzo.me')).toBeNull();
    expect(parsePayMethod('cashapp', 'https://cash.app')).toBeNull();
  });

  it('keeps any other pay link whole, made https', () => {
    expect(parsePayMethod('link', 'bunq.me/ben')).toEqual({ kind: 'link', handle: 'https://bunq.me/ben' });
    expect(parsePayMethod('link', 'HTTP://wise.com/pay/me/ben')).toEqual({ kind: 'link', handle: 'https://wise.com/pay/me/ben' });
    for (const text of ['javascript:alert(1)', 'https://', 'https://nodot', 'ftp://x.com', 'https://x.com/a b', 'https://x.com/"onclick', `https://x.com/${'a'.repeat(200)}`]) {
      expect(parsePayMethod('link', text)).toBeNull();
    }
  });

  it('knows the same way to pay, whatever the capitals', () => {
    expect(samePay({ kind: 'paypal', handle: 'Ben' }, ben('paypal'))).toBe(true);
    expect(samePay(ben('monzo'), ben('paypal'))).toBe(false);
  });
});

describe('the link to pay', () => {
  it('asks PayPal for the amount, in any currency it takes', () => {
    expect(payUrl(ben('paypal'), request(2550, 'EUR'))).toBe('https://paypal.me/ben/25.50EUR');
    expect(payUrl(ben('paypal'), request(500, 'GBP'))).toBe('https://paypal.me/ben/5.00GBP');
    expect(payUrl(ben('paypal'), request(116395, 'JPY'))).toBe('https://paypal.me/ben/116395JPY');
  });

  it('leaves the amount out where PayPal can’t take it', () => {
    // PayPal has no won, and no fractions of a forint.
    expect(payUrl(ben('paypal'), request(50000, 'KRW'))).toBe('https://paypal.me/ben');
    expect(payUrl(ben('paypal'), request(123456, 'HUF'))).toBe('https://paypal.me/ben');
    expect(payUrl(ben('paypal'), request(123400, 'HUF'))).toBe('https://paypal.me/ben/1234HUF');
    expect(payUrl(ben('paypal'), request(0, 'GBP'))).toBe('https://paypal.me/ben');
    expect(payUrl(ben('paypal'))).toBe('https://paypal.me/ben');
  });

  it('asks Monzo in pounds and Venmo in US dollars, with a note', () => {
    expect(payUrl(ben('monzo'), request(1250, 'GBP', 'Flat 4B'))).toBe('https://monzo.me/ben/12.50?d=Flat%204B');
    expect(payUrl(ben('monzo'), request(1250, 'EUR'))).toBe('https://monzo.me/ben');
    expect(payUrl(ben('venmo'), request(4250, 'USD', 'Ski & stuff'))).toBe('https://venmo.com/ben?txn=pay&amount=42.50&note=Ski%20%26%20stuff');
    expect(payUrl(ben('venmo'), request(4250, 'CAD'))).toBe('https://venmo.com/ben');
  });

  it('opens Revolut and Cash App for the amount to be typed in', () => {
    expect(payUrl(ben('revolut'), request(1250, 'GBP'))).toBe('https://revolut.me/ben');
    expect(payUrl(ben('cashapp'), request(1250, 'USD'))).toBe('https://cash.app/$ben');
    expect(asksForAmount(ben('revolut'), request(1250, 'GBP'))).toBe(false);
    expect(asksForAmount(ben('paypal'), request(1250, 'GBP'))).toBe(true);
  });

  it('opens another pay link as it is', () => {
    expect(payUrl({ kind: 'link', handle: 'https://bunq.me/ben' }, request(1250, 'EUR'))).toBe('https://bunq.me/ben');
  });

  it('shows each the way people know it', () => {
    const shown = PAY_KINDS.map((kind) => describePay(kind === 'link' ? { kind, handle: 'https://bunq.me/ben/' } : ben(kind)));
    expect(shown).toEqual(['paypal.me/ben', 'monzo.me/ben', 'revolut.me/ben', '@ben on Venmo', '$ben', 'bunq.me/ben']);
  });
});

describe('ways to pay from outside', () => {
  it('are taken only as Quits writes them', () => {
    expect(isPayMethod(ben('paypal'))).toBe(true);
    expect(isPayMethod({ kind: 'link', handle: 'https://bunq.me/ben' })).toBe(true);
    const bad = [
      null,
      'ben',
      { kind: 'paypal' },
      { kind: 'bitcoin', handle: 'ben' },
      { kind: 'paypal', handle: ' ben' },
      { kind: 'paypal', handle: '@ben' },
      { kind: 'paypal', handle: 'https://paypal.me/ben' },
      { kind: 'link', handle: 'javascript:alert(1)' },
      { kind: 'link', handle: 'http://bunq.me/ben' },
    ];
    for (const value of bad) expect(isPayMethod(value)).toBe(false);
  });

  it('make only https links, whatever was typed', () => {
    // Anything at all, and things shaped like what people paste.
    const pasted = fc
      .tuple(
        fc.constantFrom('', 'https://', 'http://', 'HTTPS://www.', 'javascript:'),
        fc.constantFrom('', 'paypal.me/', 'paypal.com/paypalme/', 'monzo.me/', 'revolut.me/', 'venmo.com/u/', 'cash.app/$', 'bunq.me/', 'x.com/a b/'),
        fc.stringMatching(/^[A-Za-z0-9._@$"'<> -]{0,24}$/),
        fc.constantFrom('', '/25GBP', '?d=Pizza', '#top', '/')
      )
      .map((parts) => parts.join(''));
    fc.assert(
      fc.property(fc.constantFrom(...PAY_KINDS), fc.oneof(fc.string({ maxLength: 80 }), pasted), fc.integer({ min: 0, max: 10_000_000 }), (kind, text, amount) => {
        const method = parsePayMethod(kind, text);
        if (!method) return;
        expect(isPayMethod(method)).toBe(true);
        expect(payUrl(method, { amount, currency: 'GBP', note: text })).toMatch(/^https:\/\/[^\s"'<>`]+$/);
      })
    );
  });
});
