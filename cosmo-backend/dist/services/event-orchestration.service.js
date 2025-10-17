"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventOrchestrationService = void 0;
const firestore_1 = require("firebase-admin/firestore");
const firebase_1 = require("../config/firebase");
const pair_matching_service_1 = require("./pair-matching.service");
const events_config_1 = require("../config/events.config");
const EVENT_TYPES = ['coffee', 'bar', 'restaurant', 'tennis', 'dog_walking', 'hiking'];
const SYSTEM_ORGANIZER = {
    id: 'cosmo-system-organizer',
    name: 'Cosmo Events',
};
function selectTemplate(eventType) {
    const templates = (0, events_config_1.getEventTemplatesByType)(eventType);
    if (templates.length > 0) {
        return templates[0];
    }
    return events_config_1.EVENT_TEMPLATES[0];
}
function calculatePairsPerEvent(eventType) {
    const template = selectTemplate(eventType);
    return Math.max(1, Math.floor(template.groupSize / 2));
}
function buildVenueOptionId(eventType, index, venue) {
    const nameSlug = venue.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${eventType}-${index}-${nameSlug}`;
}
function buildVenueOptions(eventType) {
    const venues = (0, events_config_1.getVenueOptionsForType)(eventType);
    if (!venues || venues.length === 0) {
        const fallback = selectTemplate(eventType).venue;
        return [
            {
                id: buildVenueOptionId(eventType, 0, fallback),
                name: fallback.name,
                address: fallback.address,
                coordinates: new firestore_1.GeoPoint(fallback.lat, fallback.lng),
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
        coordinates: new firestore_1.GeoPoint(venue.lat, venue.lng),
        description: venue.description,
        photos: venue.photos,
        priceRange: venue.priceRange,
        durationMinutes: venue.durationMinutes,
        additionalInfo: null,
    }));
}
function aggregateSuggestedAvailability(pairMatches) {
    const availabilityMap = new Map();
    pairMatches.forEach((match) => {
        (match.availabilityOverlapSegments || []).forEach((segment) => {
            const existing = availabilityMap.get(segment.date) || new Set();
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
function buildPendingAssignment(eventId, eventType, now) {
    return {
        eventId,
        eventType,
        status: 'pending_join',
        assignedAt: now,
        updatedAt: now,
    };
}
async function assignPendingEventToUser(userId, assignment) {
    const userRef = firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId);
    await firebase_1.db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        const userData = userDoc.exists ? userDoc.data() : undefined;
        const existingAssignments = userData?.pendingEvents || [];
        // Remove any previous assignment for the same event before adding
        const filteredAssignments = existingAssignments.filter((item) => item.eventId !== assignment.eventId);
        const updatedAssignments = [...filteredAssignments, assignment];
        tx.update(userRef, {
            pendingEvents: updatedAssignments,
            pendingEventCount: updatedAssignments.length,
        });
    });
}
async function updatePairMatchesWithEvent(pairMatches, eventId, now) {
    await Promise.all(pairMatches.map((pairMatch) => firebase_1.db.collection(firebase_1.Collections.PAIR_MATCHES)
        .doc(pairMatch.id)
        .update({
        queueStatus: 'in_event',
        pendingEventId: eventId,
        updatedAt: now,
        lastActivityAt: now,
    })));
}
async function createPendingEventDocument(eventType, pairMatches, now) {
    const template = selectTemplate(eventType);
    const tentativeDate = new Date();
    tentativeDate.setDate(tentativeDate.getDate() + 7); // Placeholder until scheduling logic is added
    const participantUserIds = Array.from(new Set(pairMatches.flatMap((pair) => pair.userIds)));
    const participantStatuses = participantUserIds.reduce((acc, userId) => {
        acc[userId] = 'pending_join';
        return acc;
    }, {});
    const venueOptions = buildVenueOptions(eventType);
    const venueVoteTotals = venueOptions.reduce((acc, option) => {
        acc[option.id] = 0;
        return acc;
    }, {});
    const suggestedTimes = aggregateSuggestedAvailability(pairMatches);
    const eventPayload = {
        title: template.title,
        description: template.description,
        category: template.category,
        eventType,
        date: firestore_1.Timestamp.fromDate(tentativeDate),
        location: {
            name: template.venue.name,
            address: template.venue.address,
            coordinates: new firestore_1.GeoPoint(template.venue.lat, template.venue.lng),
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
    const eventDoc = await firebase_1.db.collection(firebase_1.Collections.EVENTS).add(eventPayload);
    return eventDoc.id;
}
class EventOrchestrationService {
    static async processAllQueues() {
        const createdEventsByType = {
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
    static async processQueueForEventType(eventType) {
        const queuedPairs = await pair_matching_service_1.PairMatchingService.getQueuedPairsForEventType(eventType);
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
        const createdEventIds = [];
        const now = firestore_1.Timestamp.now();
        while (eligiblePairs.length >= pairsRequired) {
            const pairsForEvent = eligiblePairs.splice(0, pairsRequired);
            const eventId = await createPendingEventDocument(eventType, pairsForEvent, now);
            await updatePairMatchesWithEvent(pairsForEvent, eventId, now);
            const uniqueUserIds = new Set();
            pairsForEvent.forEach((pair) => {
                pair.userIds.forEach((id) => uniqueUserIds.add(id));
            });
            const assignment = buildPendingAssignment(eventId, eventType, now);
            await Promise.all(Array.from(uniqueUserIds).map((userId) => assignPendingEventToUser(userId, assignment)));
            createdEventIds.push(eventId);
        }
        return createdEventIds;
    }
    static async assignPairToExistingEvent(eventId, eventType, pair) {
        const now = firestore_1.Timestamp.now();
        const eventRef = firebase_1.db.collection(firebase_1.Collections.EVENTS).doc(eventId);
        const pairRef = firebase_1.db.collection(firebase_1.Collections.PAIR_MATCHES).doc(pair.id);
        const userRefs = pair.userIds.map((userId) => firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId));
        let success = false;
        await firebase_1.db.runTransaction(async (tx) => {
            const [eventSnap, pairSnap, ...userSnaps] = await Promise.all([
                tx.get(eventRef),
                tx.get(pairRef),
                ...userRefs.map((ref) => tx.get(ref)),
            ]);
            if (!eventSnap.exists || !pairSnap.exists) {
                return;
            }
            const eventData = eventSnap.data();
            if (eventData.status === 'canceled') {
                return;
            }
            const requiredPairs = eventData.requiredPairCount ?? calculatePairsPerEvent(eventType);
            const currentPairs = (eventData.pendingPairMatchIds || []).length;
            if (currentPairs >= requiredPairs) {
                return;
            }
            const pairData = pairSnap.data();
            if (pairData.pendingEventId) {
                return;
            }
            const nowDate = new Date();
            for (let i = 0; i < userSnaps.length; i++) {
                const userSnap = userSnaps[i];
                if (!userSnap.exists) {
                    return;
                }
                const userData = userSnap.data();
                const banUntil = userData.eventBanUntil?.toDate?.();
                if (banUntil && banUntil > nowDate) {
                    return;
                }
                const hasSameType = (userData.pendingEvents || []).some((assignment) => assignment.eventId !== eventId &&
                    assignment.eventType === eventType &&
                    (assignment.status === 'pending_join' || assignment.status === 'joined'));
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
            const participantUserIds = Array.from(new Set([...(eventData.participantUserIds || []), ...pair.userIds]));
            const pendingPairMatchIds = [...(eventData.pendingPairMatchIds || []), pair.id];
            const confirmations = Object.values(participantStatuses).filter((status) => status === 'confirmed').length;
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
    static async fillEventVacancies(eventId) {
        const eventSnap = await firebase_1.db.collection(firebase_1.Collections.EVENTS).doc(eventId).get();
        if (!eventSnap.exists) {
            return;
        }
        const event = { id: eventSnap.id, ...eventSnap.data() };
        if (!event.eventType) {
            return;
        }
        const requiredPairs = event.requiredPairCount ?? calculatePairsPerEvent(event.eventType);
        const currentPairs = (event.pendingPairMatchIds || []).length;
        const deficit = requiredPairs - currentPairs;
        if (deficit <= 0) {
            return;
        }
        const queuedPairs = await pair_matching_service_1.PairMatchingService.getQueuedPairsForEventType(event.eventType);
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
exports.EventOrchestrationService = EventOrchestrationService;
//# sourceMappingURL=event-orchestration.service.js.map