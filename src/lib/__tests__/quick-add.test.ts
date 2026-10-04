import * as fc from 'fast-check';

import { demoGroups } from '@/store/demo';

import { parseQuickAdd } from '../quick-add';

// Sunday 4 October 2026.
const now = new Date(2026, 9, 4, 12);
const [japan, flat] = demoGroups(now);
const everyone = ['you', 'aiko', 'ben', 'chloe', 'dev'];
const read = (text: string, group = japan) => parseQuickAdd(text, group, now);

describe('quick add', () => {
  it('reads the example: amount, payer, and who shared', () => {
    expect(read('Ramen ¥4,800, Aiko paid, split with Ben and me')).toEqual({
      amount: 4800,
      currency: 'JPY',
      description: 'Ramen',
      category: 'food',
      paidBy: 'aiko',
      among: ['you', 'aiko', 'ben'],
      date: '2026-10-04',
      said: { amount: true, payer: true, among: true, date: false, category: true },
      strangers: [],
    });
  });

  it.each([
    // [sentence, amount, currency, description, payer, among, date]
    ['drinks on me 3600 last night', 3600, 'JPY', 'Drinks', 'you', everyone, '2026-10-03'],
    ['Taxi 2.5k yen for everyone except Dev', 2500, 'JPY', 'Taxi', 'you', ['you', 'aiko', 'ben', 'chloe'], '2026-10-04'],
    ['Museum tickets 30 euros paid by Ben on Friday', 3000, 'EUR', 'Museum tickets', 'ben', everyone, '2026-10-02'],
    ['£12.50 coffee with chlo', 1250, 'GBP', 'Coffee', 'you', ['you', 'chloe'], '2026-10-04'],
    ['Sushi 9600 just Aiko', 9600, 'JPY', 'Sushi', 'you', ['aiko'], '2026-10-04'],
    ['Hotel 3 nights ¥45,000', 45000, 'JPY', 'Hotel 3 nights', 'you', everyone, '2026-10-04'],
    ['Lunch 1800 3 days ago', 1800, 'JPY', 'Lunch', 'you', everyone, '2026-10-01'],
    ['Dinner $60 on 5 Sep', 6000, 'USD', 'Dinner', 'you', everyone, '2026-09-05'],
    ['I got it: karaoke 4,000 for everyone', 4000, 'JPY', 'Karaoke', 'you', everyone, '2026-10-04'],
    ['Pizza 2400 split between Aiko, Ben & Chloe', 2400, 'JPY', 'Pizza', 'you', ['aiko', 'ben', 'chloe'], '2026-10-04'],
    ['Ben paid 6000 for the arcade with Dev and me', 6000, 'JPY', 'Arcade', 'ben', ['you', 'ben', 'dev'], '2026-10-04'],
    ['Dinner ¥4,800 for Aiko', 4800, 'JPY', 'Dinner', 'you', ['aiko'], '2026-10-04'],
    ['Breakfast 1200 last Sunday', 1200, 'JPY', 'Breakfast', 'you', everyone, '2026-09-27'],
    ['Breakfast 1200 on Sunday', 1200, 'JPY', 'Breakfast', 'you', everyone, '2026-10-04'],
    ["Dev's birthday cake ¥3000 for everyone but Dev", 3000, 'JPY', "Dev's birthday cake", 'you', ['you', 'aiko', 'ben', 'chloe'], '2026-10-04'],
    ['A$45 parking yesterday', 4500, 'AUD', 'Parking', 'you', everyone, '2026-10-03'],
    ['Udon 1,100 yen 12th of September', 1100, 'JPY', 'Udon', 'you', everyone, '2026-09-12'],
    ['Chloe picked up the bill 7480 sep 1st', 7480, 'JPY', '', 'chloe', everyone, '2026-09-01'],
  ])('reads %p', (sentence, amount, currency, description, paidBy, among, date) => {
    const draft = read(sentence);
    expect({ amount: draft.amount, currency: draft.currency, description: draft.description, paidBy: draft.paidBy, among: draft.among, date: draft.date }).toEqual({
      amount,
      currency,
      description,
      paidBy,
      among,
      date,
    });
  });

  it('reads a flat’s bills in pounds, and the decimal comma', () => {
    expect(read('Energy bill £142.30 paid by Sam', flat)).toMatchObject({ amount: 14230, currency: 'GBP', description: 'Energy bill', category: 'bills', paidBy: 'sam' });
    expect(read('groceries 23,40 € for Sam and Priya', flat)).toMatchObject({ amount: 2340, currency: 'EUR', description: 'Groceries', category: 'shopping', among: ['sam', 'priya'] });
  });

  it('names a stranger rather than guessing', () => {
    const draft = read('Dinner with Bob 3000');
    expect(draft.strangers).toEqual(['Bob']);
    expect(draft.among).toEqual(everyone);
    expect(draft.said.among).toBe(false);
  });

  it('never mistakes a common word for a name', () => {
    const group = { ...japan, members: [...japan.members, { id: 'theo', name: 'Theo', tone: 5 }] };
    expect(read('Tickets for the museum 2000', group)).toMatchObject({ among: [...everyone, 'theo'], description: 'Tickets for the museum' });
  });

  it('leaves what it can’t find for the form', () => {
    expect(read('')).toMatchObject({ amount: null, description: '', paidBy: 'you', among: everyone, date: '2026-10-04' });
    expect(read('4800')).toMatchObject({ amount: 4800, description: '' });
    expect(read('Dinner split 3 ways')).toMatchObject({ amount: null, description: 'Dinner split 3 ways' });
  });

  const names: Record<string, string> = { aiko: 'Aiko', ben: 'Ben', chloe: 'Chloe', dev: 'Dev' };
  const listWords = (ids: string[]) => {
    const words = ids.map((id) => (id === 'you' ? 'me' : names[id]));
    return words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
  };

  it('recovers what was said, whichever way it’s put', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Ramen', 'Boat tour', 'Snacks', 'Museum', 'Groceries', 'Lanterns'),
        fc.integer({ min: 1, max: 9_999_999 }),
        fc.boolean(),
        fc.constantFrom(...everyone),
        fc.subarray(everyone, { minLength: 1 }),
        fc.integer({ min: 0, max: 3 }),
        (description, amount, withSymbol, payer, among, template) => {
          const money = withSymbol ? `¥${amount.toLocaleString('en-GB')}` : `${amount} yen`;
          const payerName = payer === 'you' ? 'me' : names[payer];
          const list = listWords(among);
          const sentence = [
            `${description} ${money} paid by ${payerName} between ${list}`,
            `${payer === 'you' ? 'I' : names[payer]} paid ${money} for ${description.toLowerCase()} between ${list}`,
            `${description}, ${money}, split between ${list}, paid by ${payerName}`,
            `${money} ${description.toLowerCase()} on ${payerName} for ${list}`,
          ][template];
          const draft = read(sentence);
          expect(draft.amount).toBe(amount);
          expect(draft.currency).toBe('JPY');
          expect(draft.description).toBe(description);
          expect(draft.paidBy).toBe(payer);
          expect(draft.among).toEqual(everyone.filter((id) => among.includes(id)));
        }
      )
    );
  });
});
