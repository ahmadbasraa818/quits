import { CURRENCIES, type CurrencyCode, toInputString } from './money';

/**
 * Pay links: how a person gets paid, so whoever owes them can pay in a tap.
 * Quits only builds the link. The service it opens takes it from there.
 */

/** The services Quits makes links for, and "link" for any other way to pay. */
export const PAY_KINDS = ['paypal', 'monzo', 'revolut', 'venmo', 'cashapp', 'link'] as const;
export type PayKind = (typeof PAY_KINDS)[number];

/** One way a person gets paid: their username on a service, or a link. */
export type PayMethod = { kind: PayKind; handle: string };

/** The most ways to pay one person. */
export const MAX_PAY_METHODS = 3;

/** What a link asks for: the amount, and a note for the payment, where the service takes them. */
export type PayRequest = { amount: number; currency: CurrencyCode; note: string };

/** A username: letters and digits, with dots, dashes and underscores after the first. */
const HANDLE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
/** Any other pay link: https, a real host, and nothing that could end the link early. */
const LINK = /^https:\/\/[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(:\d{1,5})?(\/[^\s<>"'`]*)?$/;
const MAX_LINK = 200;

/** PayPal takes these currencies in a PayPal.Me link (developer.paypal.com/reference/currency-codes). */
const PAYPAL_CURRENCIES = new Set<CurrencyCode>([
  'AUD', 'BRL', 'CAD', 'CNY', 'CZK', 'DKK', 'EUR', 'HKD', 'HUF', 'ILS', 'JPY', 'MYR',
  'MXN', 'TWD', 'NZD', 'NOK', 'PHP', 'PLN', 'GBP', 'SGD', 'SEK', 'CHF', 'THB', 'USD',
]);
/** PayPal has no decimals in these, though forints and Taiwan dollars have them elsewhere. */
const PAYPAL_WHOLE = new Set<CurrencyCode>(['HUF', 'JPY', 'TWD']);

/** The amount as PayPal.Me writes it after the name ("25.50EUR", "116395JPY"), or null if PayPal can't take it. */
function paypalAmount({ amount, currency }: PayRequest): string | null {
  if (!PAYPAL_CURRENCIES.has(currency)) return null;
  if (!PAYPAL_WHOLE.has(currency)) return `${toInputString(amount, currency)}${currency}`;
  const unit = 10 ** CURRENCIES[currency].decimals;
  return amount % unit === 0 ? `${amount / unit}${currency}` : null;
}

type Service = {
  name: string;
  /** The field's hint: what to type. */
  hint: string;
  /** Where a pasted link to the service starts, longest first, to find the username in it. */
  hosts: string[];
  /** The link to pay, asking for the amount where the service can be told it. */
  url: (handle: string, request?: PayRequest) => string;
  /** How the username is shown: "paypal.me/ben", "$ben". */
  shown: (handle: string) => string;
};

export const SERVICES: Record<PayKind, Service> = {
  paypal: {
    name: 'PayPal',
    hint: 'PayPal.Me name, as in paypal.me/name',
    hosts: ['paypal.com/paypalme', 'paypal.me'],
    url: (handle, request) => {
      const amount = request && request.amount > 0 ? paypalAmount(request) : null;
      return `https://paypal.me/${handle}${amount ? `/${amount}` : ''}`;
    },
    shown: (handle) => `paypal.me/${handle}`,
  },
  monzo: {
    name: 'Monzo',
    hint: 'Monzo.me name, as in monzo.me/name',
    hosts: ['monzo.me'],
    // Monzo is in pounds, so only a request in pounds can fill in the amount.
    url: (handle, request) =>
      request && request.amount > 0 && request.currency === 'GBP'
        ? `https://monzo.me/${handle}/${toInputString(request.amount, 'GBP')}?d=${encodeURIComponent(request.note)}`
        : `https://monzo.me/${handle}`,
    shown: (handle) => `monzo.me/${handle}`,
  },
  revolut: {
    name: 'Revolut',
    hint: 'Revtag, as in revolut.me/name',
    hosts: ['revolut.me'],
    // A Revolut.me link can't ask for an amount: the person paying types it in.
    url: (handle) => `https://revolut.me/${handle}`,
    shown: (handle) => `revolut.me/${handle}`,
  },
  venmo: {
    name: 'Venmo',
    hint: 'Venmo username, as in @name',
    hosts: ['account.venmo.com/u', 'venmo.com/u', 'venmo.com'],
    // Venmo is in US dollars.
    url: (handle, request) =>
      request && request.amount > 0 && request.currency === 'USD'
        ? `https://venmo.com/${handle}?txn=pay&amount=${toInputString(request.amount, 'USD')}&note=${encodeURIComponent(request.note)}`
        : `https://venmo.com/${handle}`,
    shown: (handle) => `@${handle} on Venmo`,
  },
  cashapp: {
    name: 'Cash App',
    hint: '$Cashtag, as in $name',
    hosts: ['cash.app', 'cash.me'],
    // An amount in a Cash App link isn't relied on, so the person paying types it in.
    url: (handle) => `https://cash.app/$${handle}`,
    shown: (handle) => `$${handle}`,
  },
  link: {
    name: 'Pay link',
    hint: 'A pay link, starting https://',
    hosts: [],
    url: (handle) => handle,
    shown: (handle) => handle.replace(/^https:\/\//, '').replace(/\/$/, ''),
  },
};

const KNOWN_HOSTS = new Set(PAY_KINDS.flatMap((kind) => SERVICES[kind].hosts.map((host) => host.split('/')[0])));

/**
 * A way to pay from what someone typed or pasted: a username ("ben",
 * "@ben", "$ben"), or a link to the service ("https://paypal.me/ben/10GBP"),
 * from which the username is taken. Any other link is kept whole, made
 * https. Null if it isn't one.
 */
export function parsePayMethod(kind: PayKind, text: string): PayMethod | null {
  const typed = text.trim();
  if (kind === 'link') {
    const url = `https://${typed.replace(/^https?:\/\//i, '')}`;
    return url.length <= MAX_LINK && LINK.test(url) ? { kind, handle: url } : null;
  }
  let rest = typed.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  const host = SERVICES[kind].hosts.find((item) => rest.toLowerCase().startsWith(`${item}/`));
  if (host) rest = rest.slice(host.length + 1);
  // Anything else with a slash is a link to somewhere else.
  else if (rest.includes('/')) return null;
  rest = rest.split(/[/?#]/)[0].replace(/^[@$]/, '');
  if (KNOWN_HOSTS.has(rest.toLowerCase())) return null;
  return HANDLE.test(rest) ? { kind, handle: rest } : null;
}

/** Whether something read from outside is a way to pay, written exactly as Quits writes one. */
export function isPayMethod(value: unknown): value is PayMethod {
  if (typeof value !== 'object' || value === null) return false;
  const { kind, handle } = value as Record<string, unknown>;
  return PAY_KINDS.includes(kind as PayKind) && typeof handle === 'string' && parsePayMethod(kind as PayKind, handle)?.handle === handle;
}

/** The link to pay someone, asking for the amount where the service can be told it. */
export function payUrl(method: PayMethod, request?: PayRequest): string {
  return SERVICES[method.kind].url(method.handle, request);
}

/** Whether the link fills in the amount, or the person paying types it in. */
export function asksForAmount(method: PayMethod, request: PayRequest): boolean {
  return payUrl(method, request) !== payUrl(method);
}

/** The username as people know it: "paypal.me/ben", "$ben", "@ben on Venmo". */
export function describePay(method: PayMethod): string {
  return SERVICES[method.kind].shown(method.handle);
}

/** The same way to pay, whatever the capitals. */
export const samePay = (a: PayMethod, b: PayMethod) => a.kind === b.kind && a.handle.toLowerCase() === b.handle.toLowerCase();
