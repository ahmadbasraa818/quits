import { demoGroups } from '@/store/demo';
import { summarise } from '@/store/summary';

import { circlesExplanation, paymentLine, planText, reminderText } from '../plan-text';
import type { Group } from '../types';

const [japan] = demoGroups(new Date(2026, 9, 4));

describe('the plan as a message', () => {
  it('writes each payment from the sender’s side', () => {
    expect(paymentLine(japan, { from: 'aiko', to: 'you', amount: 29359 })).toBe('Aiko pays me ¥29,359');
    expect(paymentLine(japan, { from: 'you', to: 'ben', amount: 500 })).toBe('I pay Ben ¥500');
    expect(paymentLine(japan, { from: 'chloe', to: 'ben', amount: 118305 })).toBe('Chloe pays Ben ¥118,305');
  });

  it('lists the payments, the saving, and where it came from', () => {
    const summary = summarise(japan);
    expect(planText(japan, summary.settlement.transfers, summary.directCount)).toBe(
      [
        'Settling up for Japan trip:',
        '• Aiko pays Ben ¥116,395',
        '• Chloe pays Ben ¥84,466',
        '• Chloe pays me ¥25,829',
        '• Dev pays me ¥20,305',
        '',
        '4 payments instead of 10 pair by pair, worked out with Quits: https://ahmadbasraa818.github.io/quits/',
      ].join('\n')
    );
  });

  it('leaves out a saving there isn’t', () => {
    expect(planText(japan, [{ from: 'aiko', to: 'you', amount: 100 }], 1)).toContain('\nOne payment, worked out with Quits');
  });

  it('gives a link to pay each person who has added one', () => {
    const summary = summarise(japan);
    const text = planText(paid(japan), summary.settlement.transfers, summary.directCount);
    expect(text).toContain('• Aiko pays Ben ¥116,395\n  Pay Ben: https://paypal.me/bensmith/116395JPY\n');
    expect(text).toContain('• Dev pays me ¥20,305\n  Pay me: https://revolut.me/ahmad\n');
  });
});

/** The Japan trip with ways to pay: Ben on PayPal and Monzo, you on Revolut. */
const paid = (group: Group): Group => ({
  ...group,
  members: group.members.map((member) =>
    member.id === 'ben'
      ? { ...member, pay: [{ kind: 'paypal', handle: 'bensmith' }, { kind: 'monzo', handle: 'ben' }] }
      : member.id === 'you'
        ? { ...member, pay: [{ kind: 'revolut', handle: 'ahmad' }] }
        : member
  ),
});

describe('a reminder', () => {
  it('says what someone owes, and who to', () => {
    expect(reminderText(japan, { from: 'dev', to: 'you', amount: 20305 })).toBe(['Hi Dev, a quick reminder from Japan trip: you owe me ¥20,305.', '', 'Thanks!'].join('\n'));
  });

  it('gives every way to pay that person, asking for the amount where it can', () => {
    expect(reminderText(paid(japan), { from: 'aiko', to: 'ben', amount: 116395 })).toBe(
      [
        'Hi Aiko, a quick reminder from Japan trip: you owe Ben ¥116,395.',
        '',
        'To pay Ben:',
        'PayPal: https://paypal.me/bensmith/116395JPY',
        // Monzo is in pounds, so the person paying types in the amount.
        'Monzo: https://monzo.me/ben',
        '',
        'Thanks!',
      ].join('\n')
    );
  });
});

describe('why the plan has as many payments as it does', () => {
  it('explains one circle', () => {
    expect(circlesExplanation(japan, [['you', 'aiko', 'ben', 'chloe', 'dev']])).toBe(
      '5 people are owed or owe, and their balances only cancel out all together, so 4 payments is the fewest possible.'
    );
  });

  it('names the circles when there are several', () => {
    expect(circlesExplanation(japan, [['aiko', 'ben'], ['chloe', 'dev', 'you']])).toBe(
      'Their balances cancel out in 2 separate circles: Aiko and Ben; Chloe, Dev and you. Each settles in one payment fewer than its size, so 3 payments is the fewest possible.'
    );
    expect(circlesExplanation(japan, [['aiko', 'ben'], ['chloe', 'dev']])).toContain('so 2 payments is the fewest possible.');
  });
});
