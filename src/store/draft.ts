import { create } from 'zustand';

import type { QuickDraft } from '@/lib/quick-add';

/**
 * A quick-add draft on its way to the full expense form, which takes it once
 * when it opens. Kept in memory only: it lives for a moment, between screens.
 */
export const useDraft = create<{ draft: { groupId: string; value: QuickDraft } | null; hand: (groupId: string, value: QuickDraft) => void; take: (groupId: string) => QuickDraft | null }>((set, get) => ({
  draft: null,
  hand: (groupId, value) => set({ draft: { groupId, value } }),
  take: (groupId) => {
    const draft = get().draft;
    if (!draft || draft.groupId !== groupId) return null;
    set({ draft: null });
    return draft.value;
  },
}));
