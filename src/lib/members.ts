import { formatMoney } from './money';
import { participantsOf } from './split';
import type { Group, Member } from './types';

/** How many avatar colours there are; see the theme's `tones`. */
export const TONE_COUNT = 8;

/** The most people a group can hold. */
export const MAX_MEMBERS = 40;

/** "You" for the person using the app, otherwise their name. */
export function nameOf(group: Pick<Group, 'members' | 'me'>, id: string): string {
  if (id === group.me) return 'You';
  return group.members.find((member) => member.id === id)?.name ?? 'Someone';
}

/** A name as it reads mid-sentence: "you" for the person using the app. */
export function nameInSentence(group: Pick<Group, 'members' | 'me'>, id: string): string {
  return id === group.me ? 'you' : nameOf(group, id);
}

/** Where someone stands: "You’re owed £12.00", "Aiko owes ¥114,505", "Ben is square". */
export function standing(group: Pick<Group, 'members' | 'me' | 'currency'>, id: string, balance: number): string {
  const isMe = id === group.me;
  const name = nameOf(group, id);
  if (balance > 0) return `${isMe ? 'You’re' : `${name} is`} owed ${formatMoney(balance, group.currency)}`;
  if (balance < 0) return `${name} ${isMe ? 'owe' : 'owes'} ${formatMoney(-balance, group.currency)}`;
  return `${isMe ? 'You’re' : `${name} is`} square`;
}

/** The people who can be picked for a new expense: everyone who hasn't left. */
export function activeMembers(group: Pick<Group, 'members'>): Member[] {
  return group.members.filter((member) => !member.left);
}

/** Whether anyone's money moved through them, so removing them would rewrite history. */
export function hasHistory(group: Pick<Group, 'expenses' | 'payments'>, id: string): boolean {
  return (
    group.expenses.some((expense) => expense.paidBy === id || participantsOf(expense.split).includes(id)) ||
    group.payments.some((payment) => payment.from === id || payment.to === id)
  );
}

/** The avatar colour fewest people have, so a new face stands out from the rest. */
export function nextTone(members: Pick<Member, 'tone'>[]): number {
  const counts = Array.from({ length: TONE_COUNT }, (_, tone) => members.filter((member) => member.tone % TONE_COUNT === tone).length);
  const fewest = Math.min(...counts.slice(1));
  return counts.findIndex((count, tone) => tone > 0 && count === fewest);
}

/** The colours `count` new people would get, in turn, joining people who have `taken`. */
export function tonesFor(count: number, taken: number[] = [0]): number[] {
  const tones = [...taken];
  for (let index = 0; index < count; index += 1) tones.push(nextTone(tones.map((tone) => ({ tone }))));
  return tones.slice(taken.length);
}

/**
 * What's wrong with a list of names, in words a person can act on, or null.
 * Names must be filled in and different from each other (ignoring case), and
 * no one else can be called "You".
 */
export function namesProblem(names: string[]): string | null {
  const trimmed = names.map((name) => name.trim());
  if (trimmed.some((name) => name === '')) return 'Give everyone a name.';
  if (trimmed.some((name) => name.toLowerCase() === 'you')) return '“You” is taken: it’s what Quits calls you.';
  const seen = new Set<string>();
  for (const name of trimmed) {
    const key = name.toLowerCase();
    if (seen.has(key)) return `There are two people called ${name}. Add an initial to tell them apart.`;
    seen.add(key);
  }
  if (trimmed.length + 1 > MAX_MEMBERS) return `A group can have up to ${MAX_MEMBERS} people.`;
  return null;
}
