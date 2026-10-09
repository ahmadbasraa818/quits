import type { Transfer } from './balances';
import { nameOf } from './members';
import { formatMoney } from './money';
import { payUrl, SERVICES } from './pay';
import type { Group } from './types';

type Sendable = Pick<Group, 'name' | 'members' | 'me' | 'currency'>;

/** The links to pay whoever a payment goes to, asking for its amount where the service can be told it. */
function payLinks(group: Sendable, transfer: Transfer): { name: string; url: string }[] {
  const methods = group.members.find((member) => member.id === transfer.to)?.pay ?? [];
  const request = { amount: transfer.amount, currency: group.currency, note: group.name };
  return methods.map((method) => ({ name: SERVICES[method.kind].name, url: payUrl(method, request) }));
}

export const APP_URL = 'https://ahmadbasraa818.github.io/quits/';

/** One payment as the person sending the plan would write it: "Aiko pays me ¥29,359", "I pay Ben £12.00". */
export function paymentLine(group: Pick<Group, 'members' | 'me' | 'currency'>, transfer: Transfer): string {
  const from = transfer.from === group.me ? 'I' : nameOf(group, transfer.from);
  const verb = transfer.from === group.me ? 'pay' : 'pays';
  const to = transfer.to === group.me ? 'me' : nameOf(group, transfer.to);
  return `${from} ${verb} ${to} ${formatMoney(transfer.amount, group.currency)}`;
}

/** The plan as a message to send the group, with a link to pay each person who has added one. */
export function planText(group: Sendable, transfers: Transfer[], directCount: number): string {
  const count = transfers.length;
  const saving = directCount > count ? ` instead of ${directCount} pair by pair` : '';
  return [
    `Settling up for ${group.name}:`,
    ...transfers.flatMap((transfer) => {
      const [link] = payLinks(group, transfer);
      const line = `• ${paymentLine(group, transfer)}`;
      return link ? [line, `  Pay ${transfer.to === group.me ? 'me' : nameOf(group, transfer.to)}: ${link.url}`] : [line];
    }),
    '',
    `${count === 1 ? 'One payment' : `${count} payments`}${saving}, worked out with Quits: ${APP_URL}`,
  ].join('\n');
}

/**
 * A friendly reminder to whoever makes a payment: what they owe, and who
 * to, with every way to pay that person has added.
 */
export function reminderText(group: Sendable, transfer: Transfer): string {
  const payee = transfer.to === group.me ? 'me' : nameOf(group, transfer.to);
  const links = payLinks(group, transfer);
  return [
    `Hi ${nameOf(group, transfer.from)}, a quick reminder from ${group.name}: you owe ${payee} ${formatMoney(transfer.amount, group.currency)}.`,
    ...(links.length > 0 ? ['', `To pay ${payee}:`, ...links.map((link) => `${link.name}: ${link.url}`)] : []),
    '',
    'Thanks!',
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
