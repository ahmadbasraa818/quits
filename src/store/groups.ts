import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { createId } from '@/lib/ids';
import type { CurrencyCode } from '@/lib/money';
import type { Expense, Group, Member, Payment } from '@/lib/types';

import { demoGroups } from './demo';
import { safeStorage } from './storage';

export type NewExpense = Omit<Expense, 'id' | 'createdAt'>;
export type NewPayment = Omit<Payment, 'id' | 'createdAt'>;

type GroupsState = {
  groups: Group[];
  hydrated: boolean;
  createGroup: (input: { name: string; currency: CurrencyCode; memberNames: string[] }) => string;
  addExpense: (groupId: string, expense: NewExpense) => string;
  updateExpense: (groupId: string, expenseId: string, expense: NewExpense) => void;
  removeExpense: (groupId: string, expenseId: string) => Expense | undefined;
  restoreExpense: (groupId: string, expense: Expense) => void;
  recordPayment: (groupId: string, payment: NewPayment) => string;
  removePayment: (groupId: string, paymentId: string) => void;
  resetDemo: () => void;
};

const updateGroup = (groups: Group[], groupId: string, change: (group: Group) => Group) =>
  groups.map((group) => (group.id === groupId ? change(group) : group));

export const useGroups = create<GroupsState>()(
  persist(
    (set, get) => ({
      groups: demoGroups(),
      hydrated: false,

      createGroup: ({ name, currency, memberNames }) => {
        const id = createId('g');
        const members: Member[] = [
          { id: 'you', name: 'You', tone: 0 },
          ...memberNames.map((memberName, index) => ({ id: createId('m'), name: memberName, tone: (index + 1) % 8 })),
        ];
        const group: Group = { id, name, currency, members, me: 'you', expenses: [], payments: [], createdAt: Date.now() };
        set({ groups: [group, ...get().groups] });
        return id;
      },

      addExpense: (groupId, expense) => {
        const id = createId('e');
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            expenses: [...group.expenses, { ...expense, id, createdAt: Date.now() }],
          })),
        });
        return id;
      },

      updateExpense: (groupId, expenseId, expense) =>
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            expenses: group.expenses.map((item) => (item.id === expenseId ? { ...item, ...expense } : item)),
          })),
        }),

      removeExpense: (groupId, expenseId) => {
        const removed = get()
          .groups.find((group) => group.id === groupId)
          ?.expenses.find((expense) => expense.id === expenseId);
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            expenses: group.expenses.filter((expense) => expense.id !== expenseId),
          })),
        });
        return removed;
      },

      restoreExpense: (groupId, expense) =>
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            expenses: group.expenses.some((item) => item.id === expense.id) ? group.expenses : [...group.expenses, expense],
          })),
        }),

      recordPayment: (groupId, payment) => {
        const id = createId('p');
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            payments: [...group.payments, { ...payment, id, createdAt: Date.now() }],
          })),
        });
        return id;
      },

      removePayment: (groupId, paymentId) =>
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            payments: group.payments.filter((payment) => payment.id !== paymentId),
          })),
        }),

      resetDemo: () => set({ groups: demoGroups() }),
    }),
    {
      name: 'quits',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ groups: state.groups }),
      onRehydrateStorage: () => () => {
        useGroups.setState({ hydrated: true });
      },
    }
  )
);

export function useGroup(groupId: string | undefined): Group | undefined {
  return useGroups((state) => state.groups.find((group) => group.id === groupId));
}
