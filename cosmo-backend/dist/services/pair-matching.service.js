"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PairMatchingService = void 0;
const firestore_1 = require("firebase-admin/firestore");
const firebase_1 = require("../config/firebase");
const availability_1 = require("../utils/availability");
const eventMapping_1 = require("../utils/eventMapping");
const MIN_OVERLAP_SEGMENTS = 2;
const defaultPairMatchStatus = 'active';
function buildPairKey(userIdA, userIdB) {
    return [userIdA, userIdB].sort().join(':');
}
function sanitizeAvailability(availability) {
    return (0, availability_1.normalizeAvailabilityMap)(availability);
}
function deriveQueueStatus(hasSufficientAvailability, sharedEventTypes) {
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
function hydratePairMatch(id, data) {
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
class PairMatchingService {
    static async upsertPairMatch(userA, userB) {
        const now = firestore_1.Timestamp.now();
        const pairKey = buildPairKey(userA.id, userB.id);
        const normalizedAvailabilityA = sanitizeAvailability(userA.profile?.availability);
        const normalizedAvailabilityB = sanitizeAvailability(userB.profile?.availability);
        const overlap = (0, availability_1.computeAvailabilityOverlap)(normalizedAvailabilityA, normalizedAvailabilityB);
        const hasSufficientAvailability = overlap.totalSegments >= MIN_OVERLAP_SEGMENTS;
        const sharedEventTypes = (0, eventMapping_1.getSharedEventTypes)(userA.profile?.interests || [], userB.profile?.interests || []);
        const { queueStatus, queueEventType, suggestedEventType } = deriveQueueStatus(hasSufficientAvailability, sharedEventTypes);
        const baseData = {
            pairKey,
            userIds: [userA.id, userB.id].sort(),
            status: defaultPairMatchStatus,
            queueStatus,
            queueEventType,
            sharedEventTypes,
            suggestedEventType,
            availabilityOverlapCount: overlap.totalSegments,
            availabilityOverlapSegments: overlap.segments,
            availabilityComputedAt: now,
            hasSufficientAvailability,
            createdAt: now,
            updatedAt: now,
            lastActivityAt: now,
            pendingEventId: null,
        };
        const existingSnapshot = await firebase_1.db
            .collection(firebase_1.Collections.PAIR_MATCHES)
            .where('pairKey', '==', pairKey)
            .limit(1)
            .get();
        if (existingSnapshot.empty) {
            const docRef = await firebase_1.db.collection(firebase_1.Collections.PAIR_MATCHES).add(baseData);
            return hydratePairMatch(docRef.id, baseData);
        }
        const docRef = existingSnapshot.docs[0].ref;
        const prevData = existingSnapshot.docs[0].data();
        const updatePayload = {
            queueStatus,
            queueEventType,
            sharedEventTypes,
            suggestedEventType,
            availabilityOverlapCount: overlap.totalSegments,
            availabilityOverlapSegments: overlap.segments,
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
    static async getQueuedPairsForEventType(eventType) {
        const snapshot = await firebase_1.db
            .collection(firebase_1.Collections.PAIR_MATCHES)
            .where('queueStatus', '==', 'queued')
            .where('queueEventType', '==', eventType)
            .get();
        return snapshot.docs.map(doc => hydratePairMatch(doc.id, doc.data()));
    }
    static async getPairMatchesForUser(userId) {
        const snapshot = await firebase_1.db
            .collection(firebase_1.Collections.PAIR_MATCHES)
            .where('userIds', 'array-contains', userId)
            .where('status', '==', 'active')
            .orderBy('createdAt', 'desc')
            .get();
        return snapshot.docs.map(doc => hydratePairMatch(doc.id, doc.data()));
    }
}
exports.PairMatchingService = PairMatchingService;
//# sourceMappingURL=pair-matching.service.js.map