import { Timestamp } from 'firebase-admin/firestore';
import { db, Collections } from '../config/firebase';
import {
  Event,
  EventParticipant,
  EventType,
  PendingEventAssignment,
  User,
  EventVenueOption,
} from '../types';
import { EventOrchestrationService } from './event-orchestration.service';
import { GroupChatService } from './group-chat.service';

function getParticipantDocId(eventId: string, userId: string): string {
  return `${eventId}_${userId}`;
}

function cloneEventData(eventSnap: FirebaseFirestore.DocumentSnapshot): Event {
  return {
    id: eventSnap.id,
    ...(eventSnap.data() as any),
  } as Event;
}

function normalizeEventType(event: Event): EventType {
  return event.eventType || 'coffee';
}

function upsertPendingAssignment(
  assignments: PendingEventAssignment[] | undefined,
  eventId: string,
  eventType: EventType,
  status: PendingEventAssignment['status'],
  now: Timestamp
): PendingEventAssignment[] {
  const safeAssignments = assignments ? assignments.map((assignment) => ({ ...assignment })) : [];
  const index = safeAssignments.findIndex((assignment) => assignment.eventId === eventId);

  if (index >= 0) {
    safeAssignments[index] = {
      ...safeAssignments[index],
      eventId,
      eventType,
      status,
      updatedAt: now,
    };
  } else {
    safeAssignments.push({
      eventId,
      eventType,
      status,
      assignedAt: now,
      updatedAt: now,
    });
  }

  return safeAssignments;
}

function extractVenue(event: Event, venueId: string | null | undefined): EventVenueOption | undefined {
  if (!venueId) return undefined;
  return event.venueOptions?.find((option) => option.id === venueId);
}

export class EventParticipationService {
  static async joinEvent(eventId: string, user: User): Promise<{ event: Event; participant: EventParticipant }> {
    const now = Timestamp.now();
    const eventRef = db.collection(Collections.EVENTS).doc(eventId);
    const participantRef = db.collection(Collections.EVENT_PARTICIPANTS).doc(
      getParticipantDocId(eventId, user.id)
    );
    const userRef = db.collection(Collections.USERS).doc(user.id);

    let updatedEvent: Event | null = null;
    let updatedParticipant: EventParticipant | null = null;

    await db.runTransaction(async (tx) => {
      const [eventSnap, participantSnap, userSnap] = await Promise.all([
        tx.get(eventRef),
        tx.get(participantRef),
        tx.get(userRef),
      ]);

      if (!eventSnap.exists) {
        throw new Error('Event not found');
      }

      const eventData = cloneEventData(eventSnap);

      if (eventData.status !== 'pending_join' && eventData.status !== 'published') {
        throw new Error('Event is not accepting joins');
      }

      if (!eventData.participantUserIds?.includes(user.id)) {
        throw new Error('User is not assigned to this event');
      }

      const participantStatuses = eventData.participantStatuses || {};
      const currentStatus = participantStatuses[user.id];

      const userData = userSnap.exists ? (userSnap.data() as User) : undefined;
      const banUntil = userData?.eventBanUntil?.toDate?.();
      if (banUntil && banUntil > new Date()) {
        throw new Error('You are temporarily unable to join events.');
      }

      if (currentStatus === 'joined') {
        updatedEvent = eventData;
        updatedParticipant = participantSnap.exists
          ? ({ id: participantSnap.id, ...participantSnap.data() } as EventParticipant)
          : {
              id: participantRef.id,
              eventId,
              userId: user.id,
              status: 'joined',
              joinedAt: now,
              lastStatusAt: now,
            };
        return;
      }

      const normalizedType = normalizeEventType(eventData);

      participantStatuses[user.id] = 'joined';

      const confirmations = Object.values(participantStatuses).filter(
        (status) => status === 'confirmed'
      ).length;

      tx.update(eventRef, {
        participantStatuses,
        confirmationsReceived: confirmations,
        updatedAt: now,
      });

      const assignments = upsertPendingAssignment(
        userData?.pendingEvents,
        eventId,
        normalizedType,
        'joined',
        now
      );

      const joinedEventsSet = new Set<string>(userData?.joinedEvents || []);
      joinedEventsSet.add(eventId);

      tx.update(userRef, {
        pendingEvents: assignments,
        pendingEventCount: assignments.length,
        joinedEvents: Array.from(joinedEventsSet),
      });

      tx.set(
        participantRef,
        {
          eventId,
          userId: user.id,
          status: 'joined',
          joinedAt: now,
          lastStatusAt: now,
        },
        { merge: true }
      );

      updatedEvent = {
        ...eventData,
        participantStatuses,
        updatedAt: now,
      };
      updatedParticipant = {
        id: participantRef.id,
        eventId,
        userId: user.id,
        status: 'joined',
        joinedAt: now,
        lastStatusAt: now,
      };
    });

    if (!updatedEvent || !updatedParticipant) {
      throw new Error('Failed to join event');
    }

    return { event: updatedEvent, participant: updatedParticipant };
  }

  static async submitVote(
    eventId: string,
    userId: string,
    venueOptionId: string
  ): Promise<{ event: Event; participant: EventParticipant }> {
    const now = Timestamp.now();
    const eventRef = db.collection(Collections.EVENTS).doc(eventId);
    const participantRef = db.collection(Collections.EVENT_PARTICIPANTS).doc(
      getParticipantDocId(eventId, userId)
    );

    let updatedEvent: Event | null = null;
    let updatedParticipant: EventParticipant | null = null;
    let newlyFinalized = false;

    await db.runTransaction(async (tx) => {
      const [eventSnap, participantSnap] = await Promise.all([
        tx.get(eventRef),
        tx.get(participantRef),
      ]);

      if (!eventSnap.exists) {
        throw new Error('Event not found');
      }
      if (!participantSnap.exists) {
        throw new Error('Participant not found');
      }

      const eventData = cloneEventData(eventSnap);
      const participantData = {
        id: participantSnap.id,
        ...(participantSnap.data() as any),
      } as EventParticipant;

      if (participantData.status !== 'joined') {
        throw new Error('Only joined participants can vote');
      }

      const venueOptions = eventData.venueOptions || [];
      if (!venueOptions.find((option) => option.id === venueOptionId)) {
        throw new Error('Invalid venue option');
      }

      const voteTotals = { ...(eventData.venueVoteTotals || {}) };
      const previousVote = participantData.voteVenueOptionId;
      let votesSubmittedCount = eventData.votesSubmittedCount || 0;

      if (previousVote === venueOptionId) {
        updatedEvent = eventData;
        updatedParticipant = participantData;
        return;
      }

      if (previousVote) {
        voteTotals[previousVote] = Math.max(0, (voteTotals[previousVote] || 0) - 1);
      } else {
        votesSubmittedCount += 1;
      }

      voteTotals[venueOptionId] = (voteTotals[venueOptionId] || 0) + 1;

      const participantStatuses = eventData.participantStatuses || {};
      const joinedCount = Object.values(participantStatuses).filter(
        (status) => status === 'joined'
      ).length;

      let finalVenueOptionId = eventData.finalVenueOptionId || null;

      if (!finalVenueOptionId && votesSubmittedCount >= joinedCount && joinedCount > 0) {
        const sortedOptions = Object.entries(voteTotals).sort((a, b) => b[1] - a[1]);
        finalVenueOptionId = sortedOptions[0]?.[0] || venueOptionId;
        newlyFinalized = !!finalVenueOptionId;
      }

      tx.update(eventRef, {
        venueVoteTotals: voteTotals,
        votesSubmittedCount,
        finalVenueOptionId,
        updatedAt: now,
      });

      tx.set(
        participantRef,
        {
          voteVenueOptionId: venueOptionId,
          voteSubmittedAt: now,
          lastStatusAt: now,
        },
        { merge: true }
      );

      updatedEvent = {
        ...eventData,
        venueVoteTotals: voteTotals,
        votesSubmittedCount,
        finalVenueOptionId,
        updatedAt: now,
      };

      updatedParticipant = {
        ...participantData,
        voteVenueOptionId: venueOptionId,
        voteSubmittedAt: now,
        lastStatusAt: now,
      };
    });

    if (!updatedEvent || !updatedParticipant) {
      throw new Error('Failed to submit vote');
    }

    if (newlyFinalized && updatedEvent.finalVenueOptionId) {
      const refreshedSnap = await eventRef.get();
      const refreshedEvent = refreshedSnap.exists
        ? ({ id: refreshedSnap.id, ...refreshedSnap.data() } as Event)
        : updatedEvent;

      const participantStatuses = refreshedEvent.participantStatuses || {};
      const joinedParticipantIds = Object.entries(participantStatuses)
        .filter(([, status]) => status === 'joined')
        .map(([id]) => id);

      const finalVenue = extractVenue(
        refreshedEvent,
        refreshedEvent.finalVenueOptionId || updatedEvent.finalVenueOptionId
      );
      const chatRoomId = await GroupChatService.createOrUpdateChatForEvent(
        refreshedEvent,
        joinedParticipantIds,
        finalVenue
      );

      await eventRef.update({
        chatRoomId,
        status: 'ready',
        confirmationsReceived: refreshedEvent.confirmationsReceived || 0,
        updatedAt: Timestamp.now(),
      });

      updatedEvent = {
        ...refreshedEvent,
        chatRoomId,
        status: 'ready',
        confirmationsReceived: refreshedEvent.confirmationsReceived || 0,
      };
    }

    return { event: updatedEvent, participant: updatedParticipant };
  }

  static async respondToReminder(
    eventId: string,
    user: User,
    action: 'confirm' | 'cancel'
  ): Promise<{ event: Event; participant: EventParticipant }> {
    if (action === 'cancel') {
      return this.cancelParticipation(eventId, user);
    }

    const now = Timestamp.now();
    const eventRef = db.collection(Collections.EVENTS).doc(eventId);
    const participantRef = db.collection(Collections.EVENT_PARTICIPANTS).doc(
      getParticipantDocId(eventId, user.id)
    );
    const userRef = db.collection(Collections.USERS).doc(user.id);

    let updatedEvent: Event | null = null;
    let updatedParticipant: EventParticipant | null = null;

    await db.runTransaction(async (tx) => {
      const [eventSnap, participantSnap, userSnap] = await Promise.all([
        tx.get(eventRef),
        tx.get(participantRef),
        tx.get(userRef),
      ]);

      if (!eventSnap.exists) {
        throw new Error('Event not found');
      }
      if (!participantSnap.exists) {
        throw new Error('Participant not found');
      }

      const eventData = cloneEventData(eventSnap);
      const participantData = {
        id: participantSnap.id,
        ...(participantSnap.data() as any),
      } as EventParticipant;

      const participantStatuses = eventData.participantStatuses || {};
      const currentStatus = participantStatuses[user.id];
      if (!currentStatus || (currentStatus !== 'joined' && currentStatus !== 'confirmed')) {
        throw new Error('You are not able to confirm for this event.');
      }

      participantStatuses[user.id] = 'confirmed';

      const confirmations = Object.values(participantStatuses).filter(
        (status) => status === 'confirmed'
      ).length;

      const activeStatuses = Object.values(participantStatuses).filter(
        (status) => status !== 'canceled' && status !== 'removed'
      );
      const allConfirmed =
        activeStatuses.length > 0 &&
        activeStatuses.every((status) => status === 'confirmed' || status === 'completed');

      const newStatus = allConfirmed ? 'confirmed' : eventData.status;

      tx.update(eventRef, {
        participantStatuses,
        confirmationsReceived: confirmations,
        status: newStatus,
        updatedAt: now,
      });

      const userData = userSnap.exists ? (userSnap.data() as User) : undefined;
      const assignments = upsertPendingAssignment(
        userData?.pendingEvents,
        eventId,
        normalizeEventType(eventData),
        'confirmed',
        now
      );

      tx.update(userRef, {
        pendingEvents: assignments,
        pendingEventCount: assignments.length,
      });

      tx.set(
        participantRef,
        {
          status: 'confirmed',
          confirmedAt: now,
          lastStatusAt: now,
        },
        { merge: true }
      );

      updatedEvent = {
        ...eventData,
        participantStatuses,
        confirmationsReceived: confirmations,
        status: newStatus,
        updatedAt: now,
      };

      updatedParticipant = {
        ...participantData,
        status: 'confirmed',
        confirmedAt: now,
        lastStatusAt: now,
      };
    });

    if (!updatedEvent || !updatedParticipant) {
      throw new Error('Failed to update attendance');
    }

    return { event: updatedEvent, participant: updatedParticipant };
  }

  static async cancelParticipation(eventId: string, user: User): Promise<{ event: Event; participant: EventParticipant }> {
    const now = Timestamp.now();
    const eventRef = db.collection(Collections.EVENTS).doc(eventId);
    const participantRef = db.collection(Collections.EVENT_PARTICIPANTS).doc(
      getParticipantDocId(eventId, user.id)
    );
    const userRef = db.collection(Collections.USERS).doc(user.id);

    let updatedEvent: Event | null = null;
    let updatedParticipant: EventParticipant | null = null;
    let pairMatchIdToReset: string | null = null;
    let otherUserId: string | null = null;
    let eventTypeForReplacement: EventType | null = null;

    await db.runTransaction(async (tx) => {
      const [eventSnap, participantSnap, userSnap] = await Promise.all([
        tx.get(eventRef),
        tx.get(participantRef),
        tx.get(userRef),
      ]);

      if (!eventSnap.exists) {
        throw new Error('Event not found');
      }

      if (!participantSnap.exists) {
        throw new Error('Participant not found');
      }

      const eventData = cloneEventData(eventSnap);
      eventTypeForReplacement = eventData.eventType ? eventData.eventType : null;

      const participantData = {
        id: participantSnap.id,
        ...(participantSnap.data() as any),
      } as EventParticipant;

      const participantStatuses = eventData.participantStatuses || {};
      if (!participantStatuses[user.id]) {
        throw new Error('User is not part of this event');
      }

      const voteTotals = { ...(eventData.venueVoteTotals || {}) };
      let votesSubmittedCount = eventData.votesSubmittedCount || 0;

      if (participantData.voteVenueOptionId) {
        const optionId = participantData.voteVenueOptionId;
        voteTotals[optionId] = Math.max(0, (voteTotals[optionId] || 0) - 1);
        votesSubmittedCount = Math.max(0, votesSubmittedCount - 1);
      }

      const pairMatchIds = eventData.pendingPairMatchIds || [];
      for (const pairId of pairMatchIds) {
        const pairRef = db.collection(Collections.PAIR_MATCHES).doc(pairId);
        const pairSnap = await tx.get(pairRef);
        if (pairSnap.exists) {
          const pairData = pairSnap.data() as any;
          if (Array.isArray(pairData.userIds) && pairData.userIds.includes(user.id)) {
            pairMatchIdToReset = pairSnap.id;
            otherUserId = pairData.userIds.find((id: string) => id !== user.id) || null;
            break;
          }
        }
      }

      let participantUserIds = (eventData.participantUserIds || []).filter((id) => id !== user.id);
      participantStatuses[user.id] = 'canceled';

      let otherAssignments: PendingEventAssignment[] = [];
      let otherJoinedEvents: string[] = [];
      let otherParticipantVoteOption: string | null = null;

      if (otherUserId) {
        participantUserIds = participantUserIds.filter((id) => id !== otherUserId);
        participantStatuses[otherUserId] = 'removed';

        const otherUserRef = db.collection(Collections.USERS).doc(otherUserId);
        const otherUserSnap = await tx.get(otherUserRef);
        if (otherUserSnap.exists) {
          const otherUserData = otherUserSnap.data() as User;
          otherAssignments = upsertPendingAssignment(
            otherUserData.pendingEvents,
            eventId,
            normalizeEventType(eventData),
            'canceled',
            now
          );
          const joinedSet = new Set<string>(otherUserData.joinedEvents || []);
          joinedSet.delete(eventId);
          otherJoinedEvents = Array.from(joinedSet);

          tx.update(otherUserRef, {
            pendingEvents: otherAssignments,
            pendingEventCount: otherAssignments.length,
            joinedEvents: otherJoinedEvents,
          });
        }

        const otherParticipantRef = db
          .collection(Collections.EVENT_PARTICIPANTS)
          .doc(getParticipantDocId(eventId, otherUserId));
        const otherParticipantSnap = await tx.get(otherParticipantRef);
        if (otherParticipantSnap.exists) {
          const otherParticipant = otherParticipantSnap.data() as any;
          otherParticipantVoteOption = otherParticipant.voteVenueOptionId || null;

          tx.set(
            otherParticipantRef,
            {
              status: 'removed',
              lastStatusAt: now,
            },
            { merge: true }
          );
        }
      }

      if (otherParticipantVoteOption) {
        voteTotals[otherParticipantVoteOption] = Math.max(
          0,
          (voteTotals[otherParticipantVoteOption] || 0) - 1
        );
        votesSubmittedCount = Math.max(0, votesSubmittedCount - 1);
      }

      const pendingPairMatchIds = pairMatchIdToReset
        ? (eventData.pendingPairMatchIds || []).filter((id) => id !== pairMatchIdToReset)
        : eventData.pendingPairMatchIds || [];

      const confirmations = Object.values(participantStatuses).filter(
        (status) => status === 'confirmed'
      ).length;

      const activeStatuses = Object.values(participantStatuses).filter(
        (status) => status !== 'canceled' && status !== 'removed'
      );
      const allConfirmed =
        activeStatuses.length > 0 &&
        activeStatuses.every((status) => status === 'confirmed' || status === 'completed');

      let newEventStatus = eventData.status;
      if (activeStatuses.length === 0) {
        newEventStatus = 'pending_join';
      } else if (allConfirmed) {
        newEventStatus = 'confirmed';
      } else if (eventData.finalVenueOptionId) {
        newEventStatus = 'ready';
      }

      tx.update(eventRef, {
        participantStatuses,
        participantUserIds,
        pendingPairMatchIds,
        venueVoteTotals: voteTotals,
        votesSubmittedCount,
        confirmationsReceived: confirmations,
        status: newEventStatus,
        updatedAt: now,
      });

      const userData = userSnap.exists ? (userSnap.data() as User) : undefined;
      const normalizedType = normalizeEventType(eventData);
      const userAssignments = upsertPendingAssignment(
        userData?.pendingEvents,
        eventId,
        normalizedType,
        'canceled',
        now
      );

      const joinedEventsSet = new Set<string>(userData?.joinedEvents || []);
      joinedEventsSet.delete(eventId);

      let cancelCount = (userData?.eventCancelCount ?? 0) + 1;
      let banUntilTimestamp: Timestamp | null = userData?.eventBanUntil ?? null;

      if (cancelCount >= 3) {
        const banUntilDate = new Date();
        banUntilDate.setDate(banUntilDate.getDate() + 7);
        banUntilTimestamp = Timestamp.fromDate(banUntilDate);
        cancelCount = 0;
      }

      tx.update(userRef, {
        pendingEvents: userAssignments,
        pendingEventCount: userAssignments.length,
        joinedEvents: Array.from(joinedEventsSet),
        eventCancelCount: cancelCount,
        eventBanUntil: banUntilTimestamp,
      });

      tx.set(
        participantRef,
        {
          status: 'canceled',
          canceledAt: now,
          lastStatusAt: now,
        },
        { merge: true }
      );

      updatedEvent = {
        ...eventData,
        participantStatuses,
        participantUserIds,
        pendingPairMatchIds,
        venueVoteTotals: voteTotals,
        votesSubmittedCount,
        confirmationsReceived: confirmations,
        status: newEventStatus,
        updatedAt: now,
      };

      updatedParticipant = {
        ...participantData,
        status: 'canceled',
        canceledAt: now,
        lastStatusAt: now,
      };
    });

    if (!updatedEvent || !updatedParticipant) {
      throw new Error('Failed to cancel participation');
    }

    if (pairMatchIdToReset) {
      await db.collection(Collections.PAIR_MATCHES).doc(pairMatchIdToReset).update({
        queueStatus: 'sidelined',
        status: 'inactive',
        pendingEventId: null,
        updatedAt: Timestamp.now(),
      });
    }

    if (eventTypeForReplacement) {
      await EventOrchestrationService.fillEventVacancies(eventId);
    }

    return { event: updatedEvent, participant: updatedParticipant };
  }
}
