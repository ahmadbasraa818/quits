import type { CategoryId } from './categories';
import { addDays, daysAgo, localDate, parseLocalDate } from './dates';
import { likelyCurrency } from './expenses';
import { activeMembers } from './members';
import { CurrencyCode, isCurrencyCode, MAX_AMOUNT, parseAmount } from './money';
import { fold } from './text';
import type { Group } from './types';

/**
 * An expense read from a sentence: "Ramen ¥4,800, Aiko paid, split with Ben
 * and me", "drinks on me 36 quid last night", "taxi 2.5k yen for everyone
 * except Dev". Whatever the sentence doesn't say falls back to what the form
 * would start with: you paid, everyone shares, today.
 */
export type QuickDraft = {
  /** Minor units of `currency`, or null when there's no amount. */
  amount: number | null;
  currency: CurrencyCode;
  description: string;
  category: CategoryId;
  paidBy: string;
  among: string[];
  date: string;
  /** What the sentence said, as opposed to what was assumed. */
  said: { amount: boolean; payer: boolean; among: boolean; date: boolean; category: boolean };
  /** Words in a name's place that aren't anyone in the group: "with Bob". */
  strangers: string[];
};

type Kind = 'word' | 'number' | 'symbol' | 'punct';
type Token = { text: string; start: number; end: number; kind: Kind; used: boolean };

// Symbols first, so "A$5" is Australian dollars rather than the word "a".
const TOKEN = /(nz\$|hk\$|mx\$|nt\$|cn¥|a\$|c\$|s\$|r\$|[£€$¥₩₹₫฿₺₱₪])|([a-z]+(?:['’][a-z]+)?)|(\d+(?:[.,]\d+)*)|([,&+:;!?\-–])/gu;

const DOLLARS: CurrencyCode[] = ['USD', 'AUD', 'CAD', 'NZD', 'SGD', 'HKD', 'TWD'];
const SYMBOLS: Record<string, CurrencyCode | 'dollar' | 'yen'> = {
  '£': 'GBP', '€': 'EUR', $: 'dollar', '¥': 'yen', '₩': 'KRW', '₹': 'INR', '₫': 'VND', '฿': 'THB', '₺': 'TRY', '₱': 'PHP', '₪': 'ILS',
  'a$': 'AUD', 'c$': 'CAD', 'nz$': 'NZD', 'hk$': 'HKD', 's$': 'SGD', 'mx$': 'MXN', 'r$': 'BRL', 'nt$': 'TWD', 'cn¥': 'CNY',
};
const CURRENCY_WORDS: Record<string, CurrencyCode | 'dollar'> = {
  yen: 'JPY', euro: 'EUR', euros: 'EUR', pound: 'GBP', pounds: 'GBP', quid: 'GBP', dollar: 'dollar', dollars: 'dollar', buck: 'dollar', bucks: 'dollar',
  won: 'KRW', baht: 'THB', dong: 'VND', rupee: 'INR', rupees: 'INR', franc: 'CHF', francs: 'CHF', zloty: 'PLN', zlotys: 'PLN', ringgit: 'MYR',
  yuan: 'CNY', rmb: 'CNY', rand: 'ZAR', lira: 'TRY', shekel: 'ILS', shekels: 'ILS', dirham: 'AED', dirhams: 'AED', forint: 'HUF', koruna: 'CZK',
  reais: 'BRL', krona: 'SEK', kronor: 'SEK', kronur: 'ISK', krone: 'NOK', kroner: 'NOK',
};
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
/** Abbreviations double as words ("sat", "wed"), so they only count after "on" or "last". */
const SHORT_WEEKDAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_WORDS: Record<string, number> = Object.fromEntries([...MONTHS.map((name, index) => [name, index]), ...MONTHS.map((name, index) => [name.slice(0, 3), index]), ['sept', 8]]);
const ORDINALS = new Set(['st', 'nd', 'rd', 'th']);
const ME = new Set(['me', 'i', 'myself', 'mine']);
const EVERYONE = new Set(['everyone', 'everybody', 'all', 'us']);
const PAY_VERBS = new Set(['paid', 'pays', 'bought', 'buys', 'covered', 'covers', 'treated', 'got', 'gets', 'grabbed', 'picked']);
const EXCEPT = new Set(['except', 'but', 'minus', 'excluding', 'bar', 'without']);
const LIST_JOINS = new Set([',', 'and', '&', '+']);
/** Words after a number that make it a count, not money: "split 3 ways". */
const COUNTS = new Set(['ways', 'way', 'people', 'persons', 'nights', 'night', 'days', 'day', 'times', 'x', 'pax', 'adults', 'kids', 'tickets', 'of']);
/** Words that join the parts of a sentence, trimmed from the ends of a description. */
const EDGE_FILLER = new Set(['for', 'on', 'at', 'of', 'the', 'a', 'an', 'and', '&', 'paid', 'split', 'with', 'to', '-', '–', ',', ':', ';', '!', '?', '+']);
/** Common words that must never be read as the start of someone's name: "the" isn't Theo. */
const COMMON = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'they', 'them', 'their', 'there', 'then', 'than', 'was', 'were', 'are', 'all', 'our', 'out',
  'one', 'two', 'too', 'his', 'her', 'him', 'she', 'not', 'but', 'can', 'had', 'has', 'have', 'get', 'got', 'its', 'new', 'old', 'big', 'day', 'way',
  'per', 'each', 'some', 'any', 'into', 'onto', 'over', 'back', 'just', 'only', 'also', 'more', 'most', 'much', 'many', 'last', 'next', 'night',
  'split', 'paid', 'pay', 'cost', 'costs', 'total', 'bill', 'tip', 'tax', 'fee', 'fees', 'cash', 'card', 'trip', 'home', 'hotel', 'room', 'week',
]);

/** Keywords that give away a category, checked in the order they appear. */
const CATEGORY_WORDS: Record<string, CategoryId> = Object.fromEntries(
  (
    [
      ['food', 'dinner lunch breakfast brunch supper ramen sushi pizza burger burgers restaurant meal meals takeaway takeout curry noodles tacos bbq barbecue dessert cake bakery snacks snack food udon tempura dumplings pho kebab sandwiches deli'],
      ['drinks', 'drinks drink beer beers wine cocktails cocktail bar pub coffee coffees tea izakaya sake latte pints pint'],
      ['transport', 'taxi taxis uber lyft cab train trains bus buses metro subway tube shinkansen suica ferry tram transit tolls toll'],
      ['travel', 'flight flights plane airfare airport visa visas luggage baggage'],
      ['car', 'car petrol fuel parking rental hire'],
      ['stay', 'hotel hotels hostel airbnb apartment ryokan room camping accommodation lodging'],
      ['home', 'rent cleaning furniture repairs repair plants'],
      ['bills', 'electricity energy water broadband internet wifi phone bill bills council insurance'],
      ['shopping', 'groceries grocery supermarket shop shopping clothes souvenirs market'],
      ['fun', 'tickets ticket museum cinema movie movies film concert karaoke games game arcade show tour gallery entry'],
      ['gifts', 'gift gifts present presents birthday flowers'],
    ] as const
  ).flatMap(([category, words]) => words.split(' ').map((word) => [word, category]))
);

/** Moves the decimal point three places right: "4.8" thousand is "4800". */
function thousands(number: string): string {
  const plain = number.replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const [whole, fraction = ''] = plain.split('.');
  const shifted = `${whole}${fraction.padEnd(3, '0').slice(0, 3)}`;
  const rest = fraction.slice(3);
  return rest ? `${shifted}.${rest}` : shifted;
}

/** The date a weekday last fell on: today, unless `strictlyBefore`, then the one before. */
function lastWeekday(weekday: number, today: string, strictlyBefore: boolean): string {
  let back = (parseLocalDate(today).getDay() - weekday + 7) % 7;
  if (back === 0 && strictlyBefore) back = 7;
  return addDays(today, -back);
}

/** A day and month in whichever year makes it most recent, at most a day ahead of today. */
function recentDate(day: number, month: number, today: string): string | null {
  const year = parseLocalDate(today).getFullYear();
  for (const candidate of [year, year - 1]) {
    const date = new Date(candidate, month, day);
    if (date.getMonth() !== month) return null;
    if (localDate(date) <= addDays(today, 1)) return localDate(date);
  }
  return null;
}

export function parseQuickAdd(text: string, group: Group, now = new Date()): QuickDraft {
  const today = daysAgo(0, now);
  const original = text.normalize('NFC');
  // Folded one character at a time, so a position in it is the same position in the original.
  const folded = [...original].map((char) => (fold(char) || char).padEnd(char.length, ' ').slice(0, char.length)).join('');
  const tokens: Token[] = [...folded.matchAll(TOKEN)].map((match) => ({
    text: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    kind: match[1] ? 'symbol' : match[2] ? 'word' : match[3] ? 'number' : 'punct',
    used: false,
  }));

  const free = (i: number) => i >= 0 && i < tokens.length && !tokens[i].used;
  const word = (i: number) => (free(i) && tokens[i].kind === 'word' ? tokens[i].text.replace(/['’]s$/, '') : '');
  const isNumber = (i: number) => free(i) && tokens[i].kind === 'number';
  const take = (from: number, to: number) => {
    for (let i = from; i <= to; i += 1) tokens[i].used = true;
  };
  const originalOf = (i: number) => original.slice(tokens[i].start, tokens[i].end);
  const capitalised = (i: number) => /^\p{Lu}/u.test(originalOf(i));

  // People: "me", a full name, a unique first name, or a unique start of a name.
  const firstNames = group.members.map((member) => fold(member.name).split(/\s+/)[0]);
  const personAt = (i: number, { prefix = true } = {}): { id: string; length: number } | null => {
    const one = word(i);
    if (!one) return null;
    if (ME.has(one)) return { id: group.me, length: 1 };
    const two = word(i + 1) ? `${one} ${word(i + 1)}` : '';
    const full = two ? group.members.find((member) => fold(member.name) === two) : undefined;
    if (full) return { id: full.id, length: 2 };
    const exact = group.members.filter((member, index) => fold(member.name) === one || firstNames[index] === one);
    if (exact.length === 1) return { id: exact[0].id, length: 1 };
    if (prefix && one.length >= 3 && !COMMON.has(one) && !CATEGORY_WORDS[one]) {
      const started = group.members.filter((member) => fold(member.name).startsWith(one));
      if (started.length === 1) return { id: started[0].id, length: 1 };
    }
    return null;
  };
  const strangers = new Set<string>();
  const noteStranger = (i: number) => {
    if (word(i) && capitalised(i) && !COMMON.has(word(i)) && !CATEGORY_WORDS[word(i)] && !EVERYONE.has(word(i))) strangers.add(originalOf(i));
  };
  /** "Ben", "Ben and me", "Aiko, Ben & Chloe", or "everyone". Ends just past the list. */
  const listAt = (i: number): { ids: string[] | 'everyone'; end: number } | null => {
    if (EVERYONE.has(word(i))) return { ids: 'everyone', end: i + 1 };
    if (word(i) === 'the' && word(i + 1) === 'group') return { ids: 'everyone', end: i + 2 };
    const ids: string[] = [];
    let cursor = i;
    for (;;) {
      const person = personAt(cursor);
      if (!person) {
        noteStranger(cursor);
        break;
      }
      ids.push(person.id);
      cursor += person.length;
      if (free(cursor) && LIST_JOINS.has(tokens[cursor].text) && personAt(cursor + 1)) cursor += 1;
      else break;
    }
    return ids.length > 0 ? { ids, end: cursor } : null;
  };

  // Dates come first, so "3 days ago" and "5 Sep" aren't taken for amounts.
  let date: string | null = null;
  for (let i = 0; i < tokens.length && date === null; i += 1) {
    const w = word(i);
    const before = word(i - 1);
    const prefixed = before === 'on' || before === 'last';
    const from = prefixed ? i - 1 : i;
    if (w === 'today' || w === 'tonight') {
      date = today;
      take(i, i);
    } else if (w === 'yesterday') {
      date = addDays(today, -1);
      take(i, i);
    } else if (w === 'this' && ['morning', 'afternoon', 'evening'].includes(word(i + 1))) {
      date = today;
      take(i, i + 1);
    } else if (w === 'last' && word(i + 1) === 'night') {
      date = addDays(today, -1);
      take(i, i + 1);
    } else if (isNumber(i) && /^\d+$/.test(tokens[i].text) && ['day', 'days', 'week', 'weeks'].includes(word(i + 1)) && word(i + 2) === 'ago') {
      date = addDays(today, -Number(tokens[i].text) * (word(i + 1).startsWith('week') ? 7 : 1));
      take(i, i + 2);
    } else if (WEEKDAYS.includes(w) || (prefixed && SHORT_WEEKDAYS[w] !== undefined)) {
      date = lastWeekday(WEEKDAYS.includes(w) ? WEEKDAYS.indexOf(w) : SHORT_WEEKDAYS[w], today, before === 'last');
      take(from, i);
    } else if (isNumber(i) && /^\d{1,2}$/.test(tokens[i].text)) {
      // "5 Sep", "5th of September"
      let j = i + 1;
      if (ORDINALS.has(word(j))) j += 1;
      if (word(j) === 'of') j += 1;
      const found = MONTH_WORDS[word(j)] !== undefined ? recentDate(Number(tokens[i].text), MONTH_WORDS[word(j)], today) : null;
      if (found) {
        date = found;
        take(before === 'on' ? i - 1 : i, j);
      }
    } else if (MONTH_WORDS[w] !== undefined && isNumber(i + 1) && /^\d{1,2}$/.test(tokens[i + 1].text)) {
      // "Sep 5", "September 5th"
      const found = recentDate(Number(tokens[i + 1].text), MONTH_WORDS[w], today);
      if (found) {
        date = found;
        take(before === 'on' ? i - 1 : i, ORDINALS.has(word(i + 2)) ? i + 2 : i + 1);
      }
    }
  }

  // The amount: a number with a currency beside it, or failing that the first number that isn't a count.
  const fallback = likelyCurrency(group);
  const resolve = (found: CurrencyCode | 'dollar' | 'yen'): CurrencyCode =>
    found === 'dollar' ? (DOLLARS.includes(fallback) ? fallback : 'USD') : found === 'yen' ? (fallback === 'CNY' ? 'CNY' : 'JPY') : found;
  const currencyWord = (i: number): CurrencyCode | null => {
    const w = word(i);
    if (!w) return null;
    if (CURRENCY_WORDS[w]) return resolve(CURRENCY_WORDS[w]);
    return isCurrencyCode(w.toUpperCase()) ? (w.toUpperCase() as CurrencyCode) : null;
  };
  const valueOf = (i: number, thousand: boolean, currency: CurrencyCode) => parseAmount(thousand ? thousands(tokens[i].text) : tokens[i].text, currency);
  let amount: { minor: number | null; currency: CurrencyCode } | null = null;
  let bare: number | null = null;
  for (let i = 0; i < tokens.length && amount === null; i += 1) {
    if (!free(i)) continue;
    const symbol = tokens[i].kind === 'symbol' && isNumber(i + 1) ? resolve(SYMBOLS[tokens[i].text]) : null;
    const n = symbol ? i + 1 : i;
    if (!symbol && !isNumber(i)) continue;
    const thousand = word(n + 1) === 'k';
    const after = thousand ? n + 2 : n + 1;
    // A code or word after the number ("30 euros", "30 EUR"), or a symbol ("23,40 €").
    const trailing = !symbol && free(after) && tokens[after].kind === 'symbol' ? resolve(SYMBOLS[tokens[after].text]) : null;
    const named = symbol ? null : (currencyWord(after) ?? trailing);
    const currency = symbol ?? named;
    if (currency) {
      amount = { minor: valueOf(n, thousand, currency), currency };
      take(i, named ? after : after - 1);
    } else if (bare === null && !COUNTS.has(word(after))) {
      bare = i;
    }
  }
  if (amount === null && bare !== null) {
    const thousand = word(bare + 1) === 'k';
    amount = { minor: valueOf(bare, thousand, fallback), currency: fallback };
    take(bare, thousand ? bare + 1 : bare);
  }

  // Who paid: "paid by Aiko", "Aiko paid", "I got it", "drinks on me".
  let paidBy: string | null = null;
  for (let i = 0; i < tokens.length && paidBy === null; i += 1) {
    if (word(i) === 'paid' && word(i + 1) === 'by') {
      const person = personAt(i + 2);
      if (person) {
        paidBy = person.id;
        take(i, i + 1 + person.length);
      } else noteStranger(i + 2);
    } else if (word(i) === 'on' && personAt(i + 1, { prefix: false })) {
      const person = personAt(i + 1, { prefix: false })!;
      paidBy = person.id;
      take(i, i + person.length);
    } else {
      const person = personAt(i);
      const verb = person ? i + person.length : -1;
      if (person && PAY_VERBS.has(word(verb))) {
        paidBy = person.id;
        // "got it", "picked up the bill", "treated us"
        let last = verb;
        if (word(last + 1) === 'up') last += 1;
        if (['it', 'this', 'that', 'us'].includes(word(last + 1))) last += 1;
        if (word(last + 1) === 'the' && word(last + 2) === 'bill') last += 2;
        take(i, last);
      }
    }
  }
  const payer = paidBy ?? group.me;

  // Who shared it: "with Ben and me", "between Aiko and Chloe", "for everyone except Dev", "just Ben".
  const everyone = activeMembers(group).map((member) => member.id);
  const except = (start: number) => {
    const left = listAt(start);
    return left && left.ids !== 'everyone' ? { ids: everyone.filter((id) => !(left.ids as string[]).includes(id)), end: left.end } : null;
  };
  let among: string[] | null = null;
  for (let i = 0; i < tokens.length && among === null; i += 1) {
    const w = word(i);
    const start = w === 'split' && ['with', 'between', 'among', 'amongst'].includes(word(i + 1)) ? i + 1 : i;
    const preposition = word(start);
    if (['with', 'between', 'among', 'amongst', 'for'].includes(preposition)) {
      const list = listAt(start + 1);
      if (!list) continue;
      let ids = list.ids === 'everyone' ? everyone : list.ids;
      let end = list.end;
      const rest = list.ids === 'everyone' && EXCEPT.has(word(end)) ? except(end + 1) : null;
      if (rest) [ids, end] = [rest.ids, rest.end];
      // Sharing "with" someone includes whoever is speaking, and whoever paid.
      if (preposition === 'with' && list.ids !== 'everyone') ids = [...new Set([group.me, payer, ...ids])];
      among = ids;
      take(i, end - 1);
    } else if (EVERYONE.has(w) && EXCEPT.has(word(i + 1))) {
      const rest = except(i + 2);
      if (!rest) continue;
      among = rest.ids;
      take(i, rest.end - 1);
    } else if (w === 'just' || w === 'only') {
      const list = listAt(i + 1);
      if (!list || list.ids === 'everyone') continue;
      among = list.ids;
      take(i, list.end - 1);
    }
  }

  // The description: what's left, without the joining words at either end.
  const kept = tokens.filter((token) => !token.used);
  while (kept.length > 0 && EDGE_FILLER.has(kept[0].text)) kept.shift();
  while (kept.length > 0 && EDGE_FILLER.has(kept[kept.length - 1].text)) kept.pop();
  let description = '';
  if (kept.length > 0) {
    const [first, last] = [kept[0], kept[kept.length - 1]];
    let cursor = first.start;
    const pieces: string[] = [];
    for (const token of tokens) {
      if (token.used && token.start >= first.start && token.end <= last.end) {
        pieces.push(original.slice(cursor, token.start));
        cursor = token.end;
      }
    }
    pieces.push(original.slice(cursor, last.end));
    description = pieces
      .join(' ')
      .replace(/(\s*[,;])+\s*(?=[,;]|$)/g, '')
      .replace(/\s+([,;.!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  // Only words left over count, so "picked up the bill" doesn't make dinner a bill.
  const keyword = tokens.find((token) => !token.used && token.kind === 'word' && CATEGORY_WORDS[token.text]);
  const minor = amount?.minor ?? null;
  return {
    amount: minor !== null && minor > 0 && minor <= MAX_AMOUNT ? minor : null,
    currency: amount?.currency ?? fallback,
    description: description.slice(0, 60),
    category: keyword ? CATEGORY_WORDS[keyword.text] : 'other',
    paidBy: payer,
    among: among ? group.members.map((member) => member.id).filter((id) => among!.includes(id)) : everyone,
    date: date ?? today,
    said: { amount: amount !== null, payer: paidBy !== null, among: among !== null, date: date !== null, category: Boolean(keyword) },
    strangers: [...strangers],
  };
}
