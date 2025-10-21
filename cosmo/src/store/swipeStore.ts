import { create } from 'zustand';
import { realAPI } from '../services/api';

interface SwipeState {
  incomingLikes: number;
  likesLast24h: number;
  loadingLikes: boolean;
  likesError: string | null;
  lastFetchedAt: string | null;
  fetchLikeStats: () => Promise<void>;
  decrementIncomingLikes: (amount?: number) => void;
}

export const useSwipeStore = create<SwipeState>((set) => ({
  incomingLikes: 0,
  likesLast24h: 0,
  loadingLikes: false,
  likesError: null,
  lastFetchedAt: null,
  fetchLikeStats: async () => {
    set((state) => {
      if (state.loadingLikes) {
        return state;
      }
      return { ...state, loadingLikes: true, likesError: null };
    });

    try {
      const response = await realAPI.swipe.getLikeSummary();
      const totalLikes = response?.data?.data?.totalLikes ?? 0;
      const likesLast24h = response?.data?.data?.likesLast24h ?? 0;

      set({
        incomingLikes: Number.isFinite(totalLikes) ? totalLikes : 0,
        likesLast24h: Number.isFinite(likesLast24h) ? likesLast24h : 0,
        loadingLikes: false,
        likesError: null,
        lastFetchedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[swipeStore] fetchLikeStats error:', error);
      set((state) => ({
        ...state,
        loadingLikes: false,
        likesError: error?.response?.data?.error || error?.message || 'Failed to load likes',
      }));
    }
  },
  decrementIncomingLikes: (amount = 1) => {
    const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;
    set((state) => {
      const nextIncoming = Math.max(0, state.incomingLikes - safeAmount);
      const nextLast24h = Math.max(0, state.likesLast24h - safeAmount);
      return {
        ...state,
        incomingLikes: nextIncoming,
        likesLast24h: nextLast24h,
      };
    });
  },
}));
