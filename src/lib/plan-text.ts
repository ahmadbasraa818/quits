import type { Transfer } from './balances';
import { nameOf } from './members';
import { formatMoney } from './money';
import type { Group } from './types';

export const APP_URL = 'https://ahmadbasraa818.github.io/quits/';

/** One payment as the person sending the plan would write it: "Aiko pays me ¥29,359", "I pay Ben £12.00". */
export function paymentLine(group: Pick<Group, 'members' | 'me' | 'currency'>, transfer: Transfer): string {
  const from = transfer.from === group.me ? 'I' : nameOf(group, transfer.from);
  const verb = transfer.from === group.me ? 'pay' : 'pays';
  const to = transfer.to === group.me ? 'me' : nameOf(group, transfer.to);
  return `${from} ${verb} ${to} ${formatMoney(transfer.amount, group.currency)}`;
}

/** The plan as a message to send the group. */
export function planText(group: Pick<Group, 'name' | 'members' | 'me' | 'currency'>, transfers: Transfer[], directCount: number): string {
  const count = transfers.length;
  const saving = directCount > count ? ` instead of ${directCount} pair by pair` : '';
  return [
    `Settling up for ${group.name}:`,
    ...transfers.map((transfer) => `• ${paymentLine(group, transfer)}`),
    '',
    `${count === 1 ? 'One payment' : `${count} payments`}${saving}, worked out with Quits: ${APP_URL}`,
  ].join('\n');
}

/** Why the plan has as many payments as it does, from the circles of people whose debts cancel out. */
export function circlesExplanation(group: Pick<Group, 'members' | 'me'>, circles: string[][]): string {
  const people = circles.reduce((sum, circle) => sum + circle.length, 0);
  const payments = people - circles.length;
  const paymentsText = payments === 1 ? 'one payment is' : `${payments} payments is`;
  if (circles.length === 1) {
    return `${people} people are owed or owe, and their balances only cancel out all together, so ${paymentsText} the fewest possible.`;
  }
  const list = (ids: string[]) => {
    const names = ids.map((id) => (id === group.me ? 'you' : nameOf(group, id)));
    return names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  };
  const described = circles.map((circle) => list(circle));
  return `Their balances cancel out in ${circles.length} separate circles: ${described.join('; ')}. Each settles in one payment fewer than its size, so ${paymentsText} the fewest possible.`;
}
