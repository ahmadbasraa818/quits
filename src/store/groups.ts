import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';

import { daysAgo } from '@/lib/dates';
import { createId } from '@/lib/ids';
import { hasHistory, nextTone, tonesFor } from '@/lib/members';
import type { CurrencyCode } from '@/lib/money';
import type { PayMethod } from '@/lib/pay';
import { catchUp } from '@/lib/repeat';
import type { Expense, Group, Member, Payment } from '@/lib/types';
import { validateGroup } from '@/lib/validate';

import { demoGroups } from './demo';
import { migrate, type Persisted, STORE_VERSION } from './migrations';
import { setAside } from './recovery';
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
  createGroup: (input: { name: string; currency: CurrencyCode; memberNames: string[] }) => string;
  editGroup: (groupId: string, edit: GroupEdit) => void;
  deleteGroup: (groupId: string) => { group: Group; index: number } | undefined;
  restoreGroup: (group: Group, index: number) => void;
  addExpense: (groupId: string, expense: NewExpense) => string;
  updateExpense: (groupId: string, expenseId: string, expense: NewExpense) => void;
  removeExpense: (groupId: string, expenseId: string) => Expense | undefined;
  restoreExpense: (groupId: string, expense: Expense) => void;
  recordPayment: (groupId: string, payment: NewPayment) => string;
  removePayment: (groupId: string, paymentId: string) => Payment | undefined;
  restorePayment: (groupId: string, payment: Payment) => void;
  /** Sets how someone gets paid. Returns how it was, to undo. */
  setPayMethods: (groupId: string, memberId: string, methods: PayMethod[]) => PayMethod[];
  /** Puts a group away, out of the list and the totals, or brings it back. */
  setArchived: (groupId: string, archived: boolean) => void;
  /** Adds every repeating expense that has come due by today. Returns how many. */
  catchUpRepeats: (today?: string) => number;
  /** Puts the demo groups back as they first were, keeping the person's own. Returns every group as it was, to undo. */
  resetDemo: () => Group[];
  /** Removes the demo groups, for someone ready to use Quits for real. Returns every group as it was, to undo. */
  removeDemo: () => Group[];
  /** A copy of a group from a shared link, with `me` as the person using this device. Returns its id. */
  importGroup: (shared: Group, me: string) => string;
  /** Brings a copy up to date with a newer link, keeping its id and who you are in it. */
  replaceGroup: (groupId: string, shared: Group) => void;
  /** Readies a group to share: your name as others will see it, and an origin its copies will know it by. Returns the group as shared. */
  prepareShare: (groupId: string, name: string) => Group | undefined;
  /** Everything replaced, from a backup. */
  replaceAll: (groups: Group[]) => void;
};

/** What copies of a group know each other by. */
export const originOf = (group: Pick<Group, 'id' | 'origin'>) => group.origin ?? group.id;

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

const isShape = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** One of the demo groups that come with Quits, rather than the person's own. */
export const isDemo = (group: Pick<Group, 'id'>) => group.id.startsWith('demo_');

// Whether this device had saved groups when Quits opened: a returning person, not a new one.
let savedBefore = false;
export const hadSavedGroups = () => savedBefore;

/**
 * The store's storage: JSON kept by safeStorage. Saved data that isn't a
 * readable save of Quits is set aside under its own key rather than written
 * over by the next save, and the app starts as if new.
 */
const groupsStorage: PersistStorage<Persisted> = {
  getItem: async (name) => {
    const raw = await safeStorage.getItem(name);
    savedBefore = raw !== null;
    if (raw === null) return null;
    try {
      const value: unknown = JSON.parse(raw);
      if (isShape(value) && isShape(value.state) && Array.isArray(value.state.groups) && Number.isInteger(value.version)) return value as { state: Persisted; version: number };
    } catch {
      // Not JSON at all: set aside below.
    }
    // Once a copy is safely kept, clear the original, so it isn't set aside again on every start.
    if (await setAside('everything this device had saved', raw)) await safeStorage.removeItem(name);
    return null;
  },
  setItem: (name, value) => safeStorage.setItem(name, JSON.stringify(value)),
  removeItem: (name) => safeStorage.removeItem(name),
};

/**
 * Loads saved groups into the store. Each must be sound, so one damaged group
 * can't stop the app from opening; a group that isn't is set aside, and the
 * rest open as normal. An empty list stays empty: the demo only fills a new
 * device.
 */
function mergeSaved(saved: unknown, current: GroupsState): GroupsState {
  if (!isShape(saved) || !Array.isArray(saved.groups)) return current;
  const groups: Group[] = [];
  const kept: Promise<boolean>[] = [];
  for (const group of saved.groups) {
    const sound = validateGroup(group, 'own');
    if (sound) groups.push(sound);
    else kept.push(setAside(isShape(group) && typeof group.name === 'string' ? `the group “${group.name}”` : 'a group', JSON.stringify(group)));
  }
  // Once every damaged group is safely kept, save the sound ones in place of the damaged list.
  if (kept.length > 0) Promise.all(kept).then((all) => all.every(Boolean) && useGroups.setState((state) => ({ groups: [...state.groups] })));
  return { ...current, groups };
}

export const useGroups = create<GroupsState>()(
  persist(
    (set, get) => ({
      groups: demoGroups(),

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

      removePayment: (groupId, paymentId) => {
        const removed = get()
          .groups.find((group) => group.id === groupId)
          ?.payments.find((payment) => payment.id === paymentId);
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            payments: group.payments.filter((payment) => payment.id !== paymentId),
            updatedAt: Date.now(),
          })),
        });
        return removed;
      },

      restorePayment: (groupId, payment) =>
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            payments: group.payments.some((item) => item.id === payment.id) ? group.payments : [...group.payments, payment],
            updatedAt: Date.now(),
          })),
        }),

      setPayMethods: (groupId, memberId, methods) => {
        const before = get()
          .groups.find((group) => group.id === groupId)
          ?.members.find((member) => member.id === memberId)?.pay;
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            members: group.members.map((member) => {
              if (member.id !== memberId) return member;
              const next: Member = { ...member, pay: methods };
              if (methods.length === 0) delete next.pay;
              return next;
            }),
            updatedAt: Date.now(),
          })),
        });
        return before ?? [];
      },

      setArchived: (groupId, archived) =>
        set({
          groups: updateGroup(get().groups, groupId, (group) => {
            const next: Group = { ...group, archived: true };
            if (!archived) delete next.archived;
            return next;
          }),
        }),

      catchUpRepeats: (today = daysAgo(0)) => {
        const now = Date.now();
        let added = 0;
        const groups = get().groups.map((group) => {
          const result = catchUp(group, today, () => createId('e'), now);
          added += result.added.length;
          return result.group;
        });
        // Only when something came due: setting the store saves it, and nothing should be written on every start.
        if (added > 0) set({ groups });
        return added;
      },

      resetDemo: () => {
        const before = get().groups;
        set({ groups: [...before.filter((group) => !isDemo(group)), ...demoGroups()] });
        return before;
      },

      removeDemo: () => {
        const before = get().groups;
        set({ groups: before.filter((group) => !isDemo(group)) });
        return before;
      },

      importGroup: (shared, me) => {
        const id = createId('g');
        const copy: Group = { ...shared, id, me, origin: originOf(shared), updatedAt: Date.now() };
        // Whether it's put away is the sharer's own business.
        delete copy.archived;
        set({ groups: [copy, ...get().groups] });
        return id;
      },

      replaceGroup: (groupId, shared) =>
        set({
          groups: updateGroup(get().groups, groupId, (local) => ({
            ...shared,
            id: local.id,
            // Who you are stays as it was, as long as you're still in the group.
            me: shared.members.some((member) => member.id === local.me) ? local.me : shared.me,
            origin: local.origin,
            archived: local.archived,
            updatedAt: Date.now(),
          })),
        }),

      prepareShare: (groupId, name) => {
        set({
          groups: updateGroup(get().groups, groupId, (group) => ({
            ...group,
            origin: group.origin ?? createId('o'),
            members: group.members.map((member) => (member.id === group.me ? { ...member, name: name.trim() } : member)),
          })),
        });
        return get().groups.find((group) => group.id === groupId);
      },

      replaceAll: (groups) => set({ groups }),
    }),
    {
      name: 'quits',
      version: STORE_VERSION,
      migrate,
      storage: groupsStorage,
      partialize: (state) => ({ groups: state.groups }),
      merge: mergeSaved,
    }
  )
);

/**
 * Whether the saved groups have loaded. Asked of the store's persistence
 * rather than kept in its state, because any change to that state is saved:
 * marking it loaded would write every group back on every start.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useGroups.persist.onFinishHydration(onChange),
    () => useGroups.persist.hasHydrated(),
    () => false
  );
}

export function useGroup(groupId: string | undefined): Group | undefined {
  return useGroups((state) => state.groups.find((group) => group.id === groupId));
}
