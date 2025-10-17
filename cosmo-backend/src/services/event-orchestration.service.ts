import { GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { db, Collections } from '../config/firebase';
import { PairMatchingService } from './pair-matching.service';
import {
  AvailabilitySegment,
  AvailabilityOverlapSegment,
  EventSuggestedAvailability,
  EventParticipantStatus,
  Event,
  EventType,
  EventVenueOption,
  PairMatch,
  PendingEventAssignment,
  User,
} from '../types';
import {
  EVENT_TEMPLATES,
  getEventTemplatesByType,
  getVenueOptionsForType,
  VenueConfig,
} from '../config/events.config';

const EVENT_TYPES: EventType[] = ['coffee', 'bar', 'restaurant', 'tennis', 'dog_walking', 'hiking'];

const SYSTEM_ORGANIZER = {
  id: 'cosmo-system-organizer',
  name: 'Cosmo Events',
};

function selectTemplate(eventType: EventType) {
  const templates = getEventTemplatesByType(eventType);
  if (templates.length > 0) {
    return templates[0];
  }
  return EVENT_TEMPLATES[0];
}

function calculatePairsPerEvent(eventType: EventType) {
  const template = selectTemplate(eventType);
  return Math.max(1, Math.floor(template.groupSize / 2));
}

function buildVenueOptionId(eventType: EventType, index: number, venue: VenueConfig): string {
  const nameSlug = venue.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${eventType}-${index}-${nameSlug}`;
}

function buildVenueOptions(eventType: EventType): EventVenueOption[] {
  const venues = getVenueOptionsForType(eventType);
  if (!venues || venues.length === 0) {
    const fallback = selectTemplate(eventType).venue;
    return [
      {
        id: buildVenueOptionId(eventType, 0, fallback),
        name: fallback.name,
        address: fallback.address,
        coordinates: new GeoPoint(fallback.lat, fallback.lng),
        description: fallback.description,
        photos: fallback.photos,
        priceRange: fallback.priceRange,
        durationMinutes: fallback.durationMinutes,
        additionalInfo: null,
      },
    ];
  }

  return venues.slice(0, 3).map((venue, index) => ({
    id: buildVenueOptionId(eventType, index, venue),
    name: venue.name,
    address: venue.address,
    coordinates: new GeoPoint(venue.lat, venue.lng),
    description: venue.description,
    photos: venue.photos,
    priceRange: venue.priceRange,
    durationMinutes: venue.durationMinutes,
    additionalInfo: null,
  }));
}

function aggregateSuggestedAvailability(pairMatches: PairMatch[]): EventSuggestedAvailability[] {
  const availabilityMap = new Map<string, Set<AvailabilitySegment>>();

  pairMatches.forEach((match) => {
    (match.availabilityOverlapSegments || []).forEach((segment: AvailabilityOverlapSegment) => {
      const existing = availabilityMap.get(segment.date) || new Set<AvailabilitySegment>();
      segment.segments.forEach((seg) => existing.add(seg));
      availabilityMap.set(segment.date, existing);
    });
  });

  const aggregated = Array.from(availabilityMap.entries())
    .map(([date, segments]) => ({
      date,
      segments: Array.from(segments).sort(),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return aggregated.slice(0, 5);
}

function buildPendingAssignment(eventId: string, eventType: EventType, now: Timestamp): PendingEventAssignment {
  return {
    eventId,
    eventType,
    status: 'pending_join',
    assignedAt: now,
    updatedAt: now,
  };
}

async function assignPendingEventToUser(userId: string, assignment: PendingEventAssignment) {
  const userRef = db.collection(Collections.USERS).doc(userId);

  await db.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    const userData = userDoc.exists ? (userDoc.data() as User) : undefined;
    const existingAssignments = userData?.pendingEvents || [];

    // Remove any previous assignment for the same event before adding
    const filteredAssignments = existingAssignments.filter(
      (item) => item.eventId !== assignment.eventId
    );
    const updatedAssignments = [...filteredAssignments, assignment];

    tx.update(userRef, {
      pendingEvents: updatedAssignments,
      pendingEventCount: updatedAssignments.length,
    });
  });
}

async function updatePairMatchesWithEvent(pairMatches: PairMatch[], eventId: string, now: Timestamp) {
  await Promise.all(
    pairMatches.map((pairMatch) =>
      db.collection(Collections.PAIR_MATCHES)
        .doc(pairMatch.id)
        .update({
          queueStatus: 'in_event',
          pendingEventId: eventId,
          updatedAt: now,
          lastActivityAt: now,
        })
    )
  );
}

async function createPendingEventDocument(
  eventType: EventType,
  pairMatches: PairMatch[],
  now: Timestamp
): Promise<string> {
  const template = selectTemplate(eventType);
  const tentativeDate = new Date();
  tentativeDate.setDate(tentativeDate.getDate() + 7); // Placeholder until scheduling logic is added
  const participantUserIds = Array.from(
    new Set<string>(
      pairMatches.flatMap((pair) => pair.userIds)
    )
  );

  const participantStatuses = participantUserIds.reduce<Record<string, EventParticipantStatus>>((acc, userId) => {
    acc[userId] = 'pending_join';
    return acc;
  }, {});

  const venueOptions = buildVenueOptions(eventType);
  const venueVoteTotals = venueOptions.reduce<Record<string, number>>((acc, option) => {
    acc[option.id] = 0;
    return acc;
  }, {});

  const suggestedTimes = aggregateSuggestedAvailability(pairMatches);

  const eventPayload = {
    title: template.title,
    description: template.description,
    category: template.category,
    eventType,
    date: Timestamp.fromDate(tentativeDate),
    location: {
      name: template.venue.name,
      address: template.venue.address,
      coordinates: new GeoPoint(template.venue.lat, template.venue.lng),
    },
    photos: template.venue.photos,
    organizer: SYSTEM_ORGANIZER,
    groups: [],
    maxGroupsCount: 1,
    groupSize: template.groupSize,
    pricePerPerson: template.priceRange.max,
    ageRange: template.ageRange,
    status: 'pending_join',
    createdAt: now,
    updatedAt: now,
    autoOrganized: true,
    pendingPairMatchIds: pairMatches.map((match) => match.id),
    requiredPairCount: Math.max(1, Math.floor(template.groupSize / 2)),
    participantUserIds,
    participantStatuses,
    venueOptions,
    venueVoteTotals,
    finalVenueOptionId: null,
    suggestedTimes,
    votesSubmittedCount: 0,
    chatRoomId: null,
    reminderSent: false,
    reminderSentAt: null,
    confirmationsReceived: 0,
  };

  const eventDoc = await db.collection(Collections.EVENTS).add(eventPayload);
  return eventDoc.id;
}

export class EventOrchestrationService {
  static async processAllQueues(): Promise<Record<EventType, string[]>> {
    const createdEventsByType: Record<EventType, string[]> = {
      coffee: [],
      bar: [],
      restaurant: [],
      tennis: [],
      dog_walking: [],
      hiking: [],
    };

    for (const eventType of EVENT_TYPES) {
      createdEventsByType[eventType] = await this.processQueueForEventType(eventType);
    }

    return createdEventsByType;
  }

  static async processQueueForEventType(eventType: EventType): Promise<string[]> {
    const queuedPairs = await PairMatchingService.getQueuedPairsForEventType(eventType);
    const pairsRequired = calculatePairsPerEvent(eventType);
    if (queuedPairs.length < pairsRequired) {
      return [];
    }

    // Remove pairs that are already tied to an event (defensive, though query should exclude them)
    const eligiblePairs = queuedPairs
      .filter((match) => !match.pendingEventId)
      .sort((a, b) => {
        const aMillis = a.availabilityComputedAt ? a.availabilityComputedAt.toMillis() : 0;
        const bMillis = b.availabilityComputedAt ? b.availabilityComputedAt.toMillis() : 0;
        return aMillis - bMillis;
      });

    const createdEventIds: string[] = [];
    const now = Timestamp.now();

    while (eligiblePairs.length >= pairsRequired) {
      const pairsForEvent = eligiblePairs.splice(0, pairsRequired);
      const eventId = await createPendingEventDocument(eventType, pairsForEvent, now);

      await updatePairMatchesWithEvent(pairsForEvent, eventId, now);

      const uniqueUserIds = new Set<string>();
      pairsForEvent.forEach((pair) => {
        pair.userIds.forEach((id) => uniqueUserIds.add(id));
      });

      const assignment = buildPendingAssignment(eventId, eventType, now);
      await Promise.all(
        Array.from(uniqueUserIds).map((userId) => assignPendingEventToUser(userId, assignment))
      );

      createdEventIds.push(eventId);
    }

    return createdEventIds;
  }

  private static async assignPairToExistingEvent(
    eventId: string,
    eventType: EventType,
    pair: PairMatch
  ): Promise<boolean> {
    const now = Timestamp.now();
    const eventRef = db.collection(Collections.EVENTS).doc(eventId);
    const pairRef = db.collection(Collections.PAIR_MATCHES).doc(pair.id);
    const userRefs = pair.userIds.map((userId) => db.collection(Collections.USERS).doc(userId));

    let success = false;

    await db.runTransaction(async (tx) => {
      const [eventSnap, pairSnap, ...userSnaps] = await Promise.all([
        tx.get(eventRef),
        tx.get(pairRef),
        ...userRefs.map((ref) => tx.get(ref)),
      ]);

      if (!eventSnap.exists || !pairSnap.exists) {
        return;
      }

      const eventData = eventSnap.data() as Event;
      if (eventData.status === 'canceled') {
        return;
      }

      const requiredPairs = eventData.requiredPairCount ?? calculatePairsPerEvent(eventType);
      const currentPairs = (eventData.pendingPairMatchIds || []).length;
      if (currentPairs >= requiredPairs) {
        return;
      }

      const pairData = pairSnap.data() as PairMatch;
      if (pairData.pendingEventId) {
        return;
      }

      const nowDate = new Date();

      for (let i = 0; i < userSnaps.length; i++) {
        const userSnap = userSnaps[i];
        if (!userSnap.exists) {
          return;
        }
        const userData = userSnap.data() as User;
        const banUntil = userData.eventBanUntil?.toDate?.();
        if (banUntil && banUntil > nowDate) {
          return;
        }
        const hasSameType = (userData.pendingEvents || []).some(
          (assignment) =>
            assignment.eventId !== eventId &&
            assignment.eventType === eventType &&
            (assignment.status === 'pending_join' || assignment.status === 'joined')
        );
        if (hasSameType) {
          return;
        }
        if ((eventData.participantUserIds || []).includes(pair.userIds[i])) {
          return;
        }
      }

      const participantStatuses = { ...(eventData.participantStatuses || {}) };
      pair.userIds.forEach((id) => {
        participantStatuses[id] = 'pending_join';
      });

      const participantUserIds = Array.from(
        new Set([...(eventData.participantUserIds || []), ...pair.userIds])
      );

      const pendingPairMatchIds = [...(eventData.pendingPairMatchIds || []), pair.id];

      const confirmations = Object.values(participantStatuses).filter(
        (status) => status === 'confirmed'
      ).length;

      tx.update(eventRef, {
        participantStatuses,
        participantUserIds,
        pendingPairMatchIds,
        confirmationsReceived: confirmations,
        updatedAt: now,
      });

      tx.update(pairRef, {
        queueStatus: 'in_event',
        pendingEventId: eventId,
        updatedAt: now,
        lastActivityAt: now,
      });

      success = true;
    });

    if (success) {
      const assignment = buildPendingAssignment(eventId, eventType, now);
      await Promise.all(pair.userIds.map((userId) => assignPendingEventToUser(userId, assignment)));
    }

    return success;
  }

  static async fillEventVacancies(eventId: string): Promise<void> {
    const eventSnap = await db.collection(Collections.EVENTS).doc(eventId).get();
    if (!eventSnap.exists) {
      return;
    }

    const event = { id: eventSnap.id, ...eventSnap.data() } as Event;
    if (!event.eventType) {
      return;
    }

    const requiredPairs = event.requiredPairCount ?? calculatePairsPerEvent(event.eventType);
    const currentPairs = (event.pendingPairMatchIds || []).length;
    const deficit = requiredPairs - currentPairs;

    if (deficit <= 0) {
      return;
    }

    const queuedPairs = await PairMatchingService.getQueuedPairsForEventType(event.eventType);
    let remaining = deficit;

    for (const pair of queuedPairs) {
      if (remaining <= 0) {
        break;
      }
      if (pair.pendingEventId) {
        continue;
      }
      const assigned = await this.assignPairToExistingEvent(eventId, event.eventType, pair);
      if (assigned) {
        remaining -= 1;
      }
    }
  }
}
