import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { createId } from '@/lib/ids';
import { hasHistory, nextTone, tonesFor } from '@/lib/members';
import type { CurrencyCode } from '@/lib/money';
import type { Expense, Group, Member, Payment } from '@/lib/types';

import { demoGroups } from './demo';
import { migrate, STORE_VERSION } from './migrations';
import { safeStorage } from './storage';

export type NewExpense = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>;
export type NewPayment = Omit<Payment, 'id' | 'createdAt'>;

/** A group's new name, currency and people, as the settings screen hands them over. */
export type GroupEdit = {
  name: string;
  currency: CurrencyCode;
  /** Everyone, in order. Existing people keep their id; new people have none. */
  members: { id?: string; name: string; left?: boolean }[];
};

type GroupsState = {
  groups: Group[];
  hydrated: boolean;
  createGroup: (input: { name: string; currency: CurrencyCode; memberNames: string[] }) => string;
  editGroup: (groupId: string, edit: GroupEdit) => void;
  deleteGroup: (groupId: string) => { group: Group; index: number } | undefined;
  restoreGroup: (group: Group, index: number) => void;
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

/**
 * Applies an edit to a group. The currency only changes while the group is
 * empty, since every amount in it is in that currency. Someone with expenses
 * or payments can't be removed: they stay, marked as having left.
 */
export function applyGroupEdit(group: Group, edit: GroupEdit, now = Date.now()): Group {
  const empty = group.expenses.length === 0 && group.payments.length === 0;
  const members: Member[] = [];
  const added: Member[] = [];
  for (const draft of edit.members) {
    const existing = draft.id ? group.members.find((member) => member.id === draft.id) : undefined;
    if (existing) {
      const isMe = existing.id === group.me;
      members.push({ ...existing, name: isMe ? existing.name : draft.name.trim(), left: !isMe && draft.left ? true : undefined });
    } else if (!draft.id) {
      const member = { id: createId('m'), name: draft.name.trim(), tone: nextTone([...group.members, ...added]) };
      added.push(member);
      members.push(member);
    }
  }
  for (const member of group.members) {
    const dropped = !members.some((kept) => kept.id === member.id);
    if (dropped && (member.id === group.me || hasHistory(group, member.id))) {
      members.push({ ...member, left: member.id === group.me ? undefined : true });
    }
  }
  return { ...group, name: edit.name.trim(), currency: empty ? edit.currency : group.currency, members, updatedAt: now };
}

export const useGroups = create<GroupsState>()(
  persist(
    (set, get) => ({
      groups: demoGroups(),
      hydrated: false,

      createGroup: ({ name, currency, memberNames }) => {
        const id = createId('g');
        const tones = tonesFor(memberNames.length);
        const members: Member[] = [{ id: 'you', name: 'You', tone: 0 }, ...memberNames.map((memberName, index) => ({ id: createId('m'), name: memberName.trim(), tone: tones[index] }))];
        const now = Date.now();
        const group: Group = { id, name: name.trim(), currency, members, me: 'you', expenses: [], payments: [], createdAt: now, updatedAt: now };
        set({ groups: [group, ...get().groups] });
        return id;
      },

      editGroup: (groupId, edit) => set({ groups: updateGroup(get().groups, groupId, (group) => applyGroupEdit(group, edit)) }),

      deleteGroup: (groupId) => {
        const index = get().groups.findIndex((group) => group.id === groupId);
        if (index < 0) return undefined;
        const group = get().groups[index];
        set({ groups: get().groups.filter((item) => item.id !== groupId) });
        return { group, index };
      },

      restoreGroup: (group, index) => {
        const groups = get().groups;
        if (groups.some((item) => item.id === group.id)) return;
        set({ groups: [...groups.slice(0, index), group, ...groups.slice(index)] });
      },

      addExpense: (groupId, expense) => {
        const id = createId('e');
        const now = Date.now();
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            expenses: [...group.expenses, { ...expense, id, createdAt: now }],
            updatedAt: now,
          })),
        });
        return id;
      },

      updateExpense: (groupId, expenseId, expense) => {
        const now = Date.now();
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            expenses: group.expenses.map((item) => (item.id === expenseId ? { ...item, ...expense, updatedAt: now } : item)),
            updatedAt: now,
          })),
        });
      },

      removeExpense: (groupId, expenseId) => {
        const removed = get()
          .groups.find((group) => group.id === groupId)
          ?.expenses.find((expense) => expense.id === expenseId);
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            expenses: group.expenses.filter((expense) => expense.id !== expenseId),
            updatedAt: Date.now(),
          })),
        });
        return removed;
      },

      restoreExpense: (groupId, expense) =>
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            expenses: group.expenses.some((item) => item.id === expense.id) ? group.expenses : [...group.expenses, expense],
            updatedAt: Date.now(),
          })),
        }),

      recordPayment: (groupId, payment) => {
        const id = createId('p');
        const now = Date.now();
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            payments: [...group.payments, { ...payment, id, createdAt: now }],
            updatedAt: now,
          })),
        });
        return id;
      },

      removePayment: (groupId, paymentId) =>
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            payments: group.payments.filter((payment) => payment.id !== paymentId),
            updatedAt: Date.now(),
          })),
        }),

      resetDemo: () => set({ groups: demoGroups() }),
    }),
    {
      name: 'quits',
      version: STORE_VERSION,
      migrate,
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
