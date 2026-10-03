import { useMemo } from 'react';

import { balancesOf, directDebts, totalOf } from '@/lib/balances';
import { settle, Settlement } from '@/lib/settle';
import type { Group } from '@/lib/types';

export type GroupSummary = {
  total: number;
  balance: Record<string, number>;
  mine: number;
  settlement: Settlement;
  /** How many payments settling pair by pair would take. */
  directCount: number;
};

export function summarise(group: Group): GroupSummary {
  const balance = balancesOf(
    group.members.map((member) => member.id),
    group.expenses,
    group.payments
  );
  return {
    total: totalOf(group.expenses),
    balance,
    mine: balance[group.me] ?? 0,
    settlement: settle(balance),
    directCount: directDebts(group.expenses, group.payments).length,
  };
}

export function useSummary(group: Group | undefined): GroupSummary | undefined {
  return useMemo(() => (group ? summarise(group) : undefined), [group]);
}
