import { Timestamp } from 'firebase-admin/firestore';
import { db, Collections } from '../config/firebase';
import {
  PairMatch,
  PairMatchQueueStatus,
  PairMatchStatus,
  User,
  EventType,
  AvailabilityMap,
  AvailabilityOverlapSegment,
} from '../types';
import {
  computeAvailabilityOverlap,
  normalizeAvailabilityMap,
} from '../utils/availability';
import { getSharedEventTypes } from '../utils/eventMapping';

const MIN_OVERLAP_SEGMENTS = 2;

type PairMatchDocument = Omit<PairMatch, 'id'>;

const defaultPairMatchStatus: PairMatchStatus = 'active';

type PairMatchUser = Pick<User, 'id'> & {
  profile?: User['profile'];
};

function buildPairKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(':');
}

function sanitizeAvailability(
  availability?: AvailabilityMap | null
): AvailabilityMap {
  return normalizeAvailabilityMap(availability);
}

function deriveQueueStatus(
  hasSufficientAvailability: boolean,
  sharedEventTypes: EventType[]
): {
  queueStatus: PairMatchQueueStatus;
  queueEventType: EventType | null;
  suggestedEventType: EventType | null;
} {
  if (!hasSufficientAvailability) {
    return {
      queueStatus: 'awaiting_availability',
      queueEventType: null,
      suggestedEventType: null,
    };
  }

  if (sharedEventTypes.length === 0) {
    return {
      queueStatus: 'awaiting_event_type',
      queueEventType: null,
      suggestedEventType: null,
    };
  }

  const [primary] = sharedEventTypes;
  return {
    queueStatus: 'queued',
    queueEventType: primary,
    suggestedEventType: primary,
  };
}

function hydratePairMatch(id: string, data: FirebaseFirestore.DocumentData): PairMatch {
  return {
    id,
    pairKey: data.pairKey,
    userIds: data.userIds,
    status: data.status,
    queueStatus: data.queueStatus,
    queueEventType: data.queueEventType ?? null,
    sharedEventTypes: data.sharedEventTypes ?? [],
    suggestedEventType: data.suggestedEventType ?? null,
    availabilityOverlapCount: data.availabilityOverlapCount ?? 0,
    availabilityOverlapSegments: data.availabilityOverlapSegments ?? [],
    availabilityComputedAt: data.availabilityComputedAt,
    hasSufficientAvailability: data.hasSufficientAvailability ?? false,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lastActivityAt: data.lastActivityAt ?? data.updatedAt ?? data.createdAt,
    pendingEventId: data.pendingEventId ?? null,
  };
}

export class PairMatchingService {
  static async upsertPairMatch(userA: PairMatchUser, userB: PairMatchUser): Promise<PairMatch> {
    const now = Timestamp.now();
    const pairKey = buildPairKey(userA.id, userB.id);

    const normalizedAvailabilityA = sanitizeAvailability(userA.profile?.availability);
    const normalizedAvailabilityB = sanitizeAvailability(userB.profile?.availability);

    const overlap = computeAvailabilityOverlap(
      normalizedAvailabilityA,
      normalizedAvailabilityB
    );

    const hasSufficientAvailability = overlap.totalSegments >= MIN_OVERLAP_SEGMENTS;
    const sharedEventTypes = getSharedEventTypes(
      userA.profile?.interests || [],
      userB.profile?.interests || []
    ) as EventType[];

    const { queueStatus, queueEventType, suggestedEventType } = deriveQueueStatus(
      hasSufficientAvailability,
      sharedEventTypes
    );

    const baseData: PairMatchDocument = {
      pairKey,
      userIds: [userA.id, userB.id].sort() as [string, string],
      status: defaultPairMatchStatus,
      queueStatus,
      queueEventType,
      sharedEventTypes,
      suggestedEventType,
      availabilityOverlapCount: overlap.totalSegments,
      availabilityOverlapSegments: overlap.segments as AvailabilityOverlapSegment[],
      availabilityComputedAt: now,
      hasSufficientAvailability,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      pendingEventId: null,
    };

    const existingSnapshot = await db
      .collection(Collections.PAIR_MATCHES)
      .where('pairKey', '==', pairKey)
      .limit(1)
      .get();

    if (existingSnapshot.empty) {
      const docRef = await db.collection(Collections.PAIR_MATCHES).add(baseData);
      return hydratePairMatch(docRef.id, baseData);
    }

    const docRef = existingSnapshot.docs[0].ref;
    const prevData = existingSnapshot.docs[0].data();

    const updatePayload: Partial<PairMatchDocument> = {
      queueStatus,
      queueEventType,
      sharedEventTypes,
      suggestedEventType,
      availabilityOverlapCount: overlap.totalSegments,
      availabilityOverlapSegments: overlap.segments as AvailabilityOverlapSegment[],
      availabilityComputedAt: now,
      hasSufficientAvailability,
      updatedAt: now,
      lastActivityAt: now,
      pendingEventId: prevData.pendingEventId ?? null,
    };

    await docRef.update(updatePayload);

    return hydratePairMatch(docRef.id, {
      ...prevData,
      ...updatePayload,
      id: docRef.id,
    });
  }

  static async getQueuedPairsForEventType(eventType: EventType): Promise<PairMatch[]> {
    const snapshot = await db
      .collection(Collections.PAIR_MATCHES)
      .where('queueStatus', '==', 'queued')
      .where('queueEventType', '==', eventType)
      .get();

    return snapshot.docs.map(doc => hydratePairMatch(doc.id, doc.data()));
  }

  static async getPairMatchesForUser(userId: string): Promise<PairMatch[]> {
    const snapshot = await db
      .collection(Collections.PAIR_MATCHES)
      .where('userIds', 'array-contains', userId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => hydratePairMatch(doc.id, doc.data()));
  }
}
