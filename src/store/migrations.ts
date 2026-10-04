import type { Group } from '@/lib/types';

import { demoGroups } from './demo';

/** What the store saves: the groups, and nothing else. */
export type Persisted = { groups: Group[] };

export const STORE_VERSION = 3;

/** What makes a group itself, without its ids, dates and timestamps, which the demo works out from today. */
function content(group: Group): string {
  return JSON.stringify({
    name: group.name,
    currency: group.currency,
    members: group.members.map(({ id, name, tone, left }) => [id, name, tone, left ?? false]),
    expenses: group.expenses.map(({ description, amount, paidBy, split, category, original, note }) => [description, amount, paidBy, split, category, original ?? null, note ?? null]),
    payments: group.payments.map(({ from, to, amount }) => [from, to, amount]),
  });
}

/**
 * Brings what a visitor saved up to date with this version of the app.
 *
 * The saved data and the demo share a version: 2 gave the Japan trip JR
 * Passes bought in pounds, and 3 an itemised bill. Every demo expense
 * records the version that added it, so the demo can be rebuilt exactly as
 * any version shipped it. A demo group still exactly that becomes today's
 * demo; anything the visitor changed is kept as it is.
 */
export function migrate(persisted: unknown, version: number): Persisted {
  const saved = persisted as Partial<Persisted> | null;
  const groups = Array.isArray(saved?.groups) ? saved.groups : [];
  if (version >= STORE_VERSION) return { groups };
  const before = demoGroups(new Date(), version);
  const after = demoGroups(new Date());
  return {
    groups: groups.map((group) => {
      const untouched = before.find((demo) => demo.id === group.id && content(demo) === content(group));
      return untouched ? (after.find((demo) => demo.id === group.id) ?? group) : group;
    }),
  };
}
