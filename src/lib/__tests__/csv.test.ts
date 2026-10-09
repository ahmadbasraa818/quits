import * as fc from 'fast-check';

import { demoGroups } from '@/store/demo';
import { summarise } from '@/store/summary';

import { csvFileName, groupCsv } from '../csv';
import { toInputString } from '../money';
import type { Group } from '../types';
import { groupArbitrary } from './arbitraries';

const [japan, flat, brighton] = demoGroups(new Date(2026, 9, 9));
const lines = (csv: string) => csv.replace(/^﻿/, '').replace(/\r\n$/, '').split('\r\n');

/** The balance row's figure for each person, in the order of the group's members. */
const balanceRow = (group: Group) => lines(groupCsv(group)).at(-1)!.split(',').slice(9, 9 + group.members.length);
const balances = (group: Group) => group.members.map((member) => toInputString(summarise(group).balance[member.id] ?? 0, group.currency));

describe('a group as a spreadsheet', () => {
  it('opens in Excel as UTF-8, with a header naming everyone', () => {
    const csv = groupCsv(flat);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines(csv)[0]).toBe('Date,Type,Description,Category,Paid by,Amount (GBP),Paid in,Currency paid in,Rate,You,Sam,Priya,Note');
  });

  it('lists every expense and payment, oldest first, and what each did to everyone', () => {
    expect(lines(groupCsv(brighton)).slice(1)).toEqual([
      `${brighton.expenses[0].date},Expense,Train tickets,Transport,Mia,61.50,,,,-20.50,41.00,-20.50,`,
      `${brighton.expenses[1].date},Expense,Fish and chips,Food,You,27.00,,,,18.00,-9.00,-9.00,`,
      `${brighton.payments[0].date},Payment,Tom paid Mia,,Tom,29.50,,,,0.00,-29.50,29.50,`,
      `${brighton.payments[1].date},Payment,You paid Mia,,You,2.50,,,,2.50,-2.50,0.00,`,
      ',Balance,,,,,,,,0.00,0.00,0.00,',
    ]);
  });

  it('gives the rate an expense in another currency was paid at', () => {
    expect(lines(groupCsv(japan)).find((line) => line.includes('JR Passes'))).toContain(',1310.00,GBP,1 GBP = 207.31 JPY,');
  });

  it('adds up to where everyone stands', () => {
    for (const group of [japan, flat, brighton]) expect(balanceRow(group)).toEqual(balances(group));
  });

  it('adds up to where everyone stands in any group', () => {
    fc.assert(
      fc.property(groupArbitrary, ({ ids, expenses, payments }) => {
        const group: Group = {
          id: 'g',
          name: 'Random',
          currency: 'GBP',
          me: ids[0],
          members: ids.map((id, tone) => ({ id, name: `P${id}`, tone })),
          expenses: expenses.map((expense, index) => ({ ...expense, id: `e${index}` })),
          payments: payments.map((payment, index) => ({ ...payment, id: `p${index}` })),
          createdAt: 0,
        };
        expect(balanceRow(group)).toEqual(balances(group));
      })
    );
  });

  it('quotes what needs quoting, and keeps text from running as a formula', () => {
    const tricky: Group = {
      ...brighton,
      members: brighton.members.map((member) => (member.id === 'mia' ? { ...member, name: 'Mia "M"' } : member)),
      expenses: [{ ...brighton.expenses[0], description: '=HYPERLINK("http://x")', note: 'Two lines,\nand a comma' }],
      payments: [],
    };
    const csv = groupCsv(tricky);
    expect(csv).toContain(',"\'=HYPERLINK(""http://x"")",');
    expect(csv).toContain(',"Two lines,\nand a comma"\r\n');
    expect(lines(csv)[0]).toContain(',"Mia ""M""",');
  });

  it('is named after the group and the day', () => {
    expect(csvFileName({ name: 'Japan trip' }, '2026-10-09')).toBe('quits-japan-trip-2026-10-09.csv');
    expect(csvFileName({ name: 'Café & bar, Łódź!' }, '2026-10-09')).toBe('quits-cafe-bar-lodz-2026-10-09.csv');
    expect(csvFileName({ name: '☕☕' }, '2026-10-09')).toBe('quits-group-2026-10-09.csv');
  });
});
