import { create } from 'zustand';
import { realAPI } from '../services/api';

export type EventParticipantStatus =
  | 'pending_join'
  | 'joined'
  | 'declined'
  | 'canceled'
  | 'completed'
  | 'removed'
  | 'confirmed';

export interface EventSuggestedAvailability {
  date: string;
  segments: string[];
}

export interface EventVenueOption {
  id: string;
  name: string;
  address: string;
  description?: string;
  photos: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  durationMinutes?: number;
  additionalInfo?: string | null;
}

export interface AssignmentMeta {
  eventId: string;
  eventType: string;
  status: EventParticipantStatus;
  assignedAt: string;
  updatedAt: string;
}

export interface EventParticipantView {
  id: string;
  eventId: string;
  userId: string;
  status: EventParticipantStatus;
  joinedAt?: string;
  canceledAt?: string;
  lastStatusAt: string;
  voteVenueOptionId?: string;
  voteSubmittedAt?: string;
}

export interface EventView {
  id: string;
  title: string;
  description: string;
  category: string;
  eventType?: string;
  date: string;
  location: {
    name: string;
    address: string;
    coordinates?: {
      latitude?: number;
      longitude?: number;
      _latitude?: number;
      _longitude?: number;
    };
  };
  photos: string[];
  organizer: {
    id: string;
    name: string;
  };
  participantUserIds?: string[];
  participantStatuses?: Record<string, EventParticipantStatus>;
  venueOptions?: EventVenueOption[];
  venueVoteTotals?: Record<string, number>;
  finalVenueOptionId?: string | null;
  suggestedTimes?: EventSuggestedAvailability[];
  votesSubmittedCount?: number;
}

export interface AssignmentView {
  assignment: AssignmentMeta;
  event: EventView;
  participant: EventParticipantView | null;
}

interface FetchOptions {
  silent?: boolean;
}

interface EventsState {
  assignments: AssignmentView[];
  pendingCount: number;
  canJoin: boolean;
  loading: boolean;
  error: string | null;
  fetchAssignments: (options?: FetchOptions) => Promise<void>;
  joinEvent: (eventId: string, venueOptionId?: string) => Promise<void>;
  voteOnEvent: (eventId: string, venueOptionId: string) => Promise<void>;
  leaveEvent: (eventId: string) => Promise<void>;
  respondToReminder: (eventId: string, action: 'confirm' | 'cancel') => Promise<void>;
}

interface AssignmentsResponse {
  assignments: AssignmentView[];
  pendingEventCount?: number;
  canJoin?: boolean;
}

const mapTimestampsToIso = (item: any) => {
  if (!item || typeof item !== 'object') {
    return item;
  }
  const result: any = Array.isArray(item) ? [] : {};
  Object.entries(item).forEach(([key, value]) => {
    if (value && typeof value === 'object' && typeof value.toDate === 'function') {
      result[key] = value.toDate().toISOString();
    } else if (value && typeof value === 'object') {
      result[key] = mapTimestampsToIso(value);
    } else {
      result[key] = value;
    }
  });
  return result;
};

export const useEventsStore = create<EventsState>((set, get) => ({
  assignments: [],
  pendingCount: 0,
  canJoin: true,
  loading: false,
  error: null,

  fetchAssignments: async (options?: FetchOptions) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      set({ loading: true, error: null });
    }
    try {
      const response = await realAPI.events.getAssignments();
      const data = response.data.data as AssignmentsResponse;
      const normalizedAssignments = (data.assignments || []).map((item) => ({
        assignment: mapTimestampsToIso(item.assignment),
        event: mapTimestampsToIso(item.event),
        participant: item.participant ? mapTimestampsToIso(item.participant) : null,
      })) as AssignmentView[];

      set({
        assignments: normalizedAssignments,
        pendingCount:
          data.pendingEventCount ?? normalizedAssignments.length,
        canJoin: data.canJoin ?? true,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('[eventsStore] Failed to fetch assignments:', error);
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Failed to fetch events';
      set({ error: message, loading: false });
      throw error;
    }
  },

  joinEvent: async (eventId: string, venueOptionId?: string) => {
    try {
      await realAPI.events.join(eventId, { venueOptionId });
      await get().fetchAssignments({ silent: true });
    } catch (error) {
      console.error('[eventsStore] Failed to join event:', error);
      throw error;
    }
  },

  voteOnEvent: async (eventId: string, venueOptionId: string) => {
    try {
      await realAPI.events.vote(eventId, { venueOptionId });
      await get().fetchAssignments({ silent: true });
    } catch (error) {
      console.error('[eventsStore] Failed to submit vote:', error);
      throw error;
    }
  },

  leaveEvent: async (eventId: string) => {
    try {
      await realAPI.events.leave(eventId);
      await get().fetchAssignments({ silent: true });
    } catch (error) {
      console.error('[eventsStore] Failed to leave event:', error);
      throw error;
    }
  },

  respondToReminder: async (eventId: string, action: 'confirm' | 'cancel') => {
    try {
      await realAPI.events.confirm(eventId, action);
      await get().fetchAssignments({ silent: true });
    } catch (error) {
      console.error('[eventsStore] Failed to update attendance:', error);
      throw error;
    }
  },
}));
