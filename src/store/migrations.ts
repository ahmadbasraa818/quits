import type { Group } from '@/lib/types';

import { demoGroups } from './demo';

/** What the store saves: the groups, and nothing else. */
export type Persisted = { groups: Group[] };

export const STORE_VERSION = 2;

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
 * Version 2 added expenses paid in other currencies, and gave the demo's
 * Japan trip one: JR Passes bought at home, in pounds. A demo group the
 * visitor never changed becomes the new demo; anything they changed is
 * kept exactly as it is.
 */
export function migrate(persisted: unknown, version: number): Persisted {
  const saved = persisted as Partial<Persisted> | null;
  const groups = Array.isArray(saved?.groups) ? saved.groups : [];
  if (version < 2) {
    const before = demoGroups(new Date(), 1);
    const after = demoGroups(new Date(), 2);
    return {
      groups: groups.map((group) => {
        const untouched = before.find((demo) => demo.id === group.id && content(demo) === content(group));
        return untouched ? (after.find((demo) => demo.id === group.id) ?? group) : group;
      }),
    };
  }
  return { groups };
}
