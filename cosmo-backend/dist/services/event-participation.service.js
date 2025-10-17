"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventParticipationService = void 0;
const firestore_1 = require("firebase-admin/firestore");
const firebase_1 = require("../config/firebase");
const event_orchestration_service_1 = require("./event-orchestration.service");
const group_chat_service_1 = require("./group-chat.service");
function getParticipantDocId(eventId, userId) {
    return `${eventId}_${userId}`;
}
function cloneEventData(eventSnap) {
    return {
        id: eventSnap.id,
        ...eventSnap.data(),
    };
}
function normalizeEventType(event) {
    return event.eventType || 'coffee';
}
function upsertPendingAssignment(assignments, eventId, eventType, status, now) {
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
    }
    else {
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
function extractVenue(event, venueId) {
    if (!venueId)
        return undefined;
    return event.venueOptions?.find((option) => option.id === venueId);
}
class EventParticipationService {
    static async joinEvent(eventId, user) {
        const now = firestore_1.Timestamp.now();
        const eventRef = firebase_1.db.collection(firebase_1.Collections.EVENTS).doc(eventId);
        const participantRef = firebase_1.db.collection(firebase_1.Collections.EVENT_PARTICIPANTS).doc(getParticipantDocId(eventId, user.id));
        const userRef = firebase_1.db.collection(firebase_1.Collections.USERS).doc(user.id);
        let updatedEvent = null;
        let updatedParticipant = null;
        await firebase_1.db.runTransaction(async (tx) => {
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
            const userData = userSnap.exists ? userSnap.data() : undefined;
            const banUntil = userData?.eventBanUntil?.toDate?.();
            if (banUntil && banUntil > new Date()) {
                throw new Error('You are temporarily unable to join events.');
            }
            if (currentStatus === 'joined') {
                updatedEvent = eventData;
                updatedParticipant = participantSnap.exists
                    ? { id: participantSnap.id, ...participantSnap.data() }
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
            const confirmations = Object.values(participantStatuses).filter((status) => status === 'confirmed').length;
            tx.update(eventRef, {
                participantStatuses,
                confirmationsReceived: confirmations,
                updatedAt: now,
            });
            const assignments = upsertPendingAssignment(userData?.pendingEvents, eventId, normalizedType, 'joined', now);
            const joinedEventsSet = new Set(userData?.joinedEvents || []);
            joinedEventsSet.add(eventId);
            tx.update(userRef, {
                pendingEvents: assignments,
                pendingEventCount: assignments.length,
                joinedEvents: Array.from(joinedEventsSet),
            });
            tx.set(participantRef, {
                eventId,
                userId: user.id,
                status: 'joined',
                joinedAt: now,
                lastStatusAt: now,
            }, { merge: true });
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
    static async submitVote(eventId, userId, venueOptionId) {
        const now = firestore_1.Timestamp.now();
        const eventRef = firebase_1.db.collection(firebase_1.Collections.EVENTS).doc(eventId);
        const participantRef = firebase_1.db.collection(firebase_1.Collections.EVENT_PARTICIPANTS).doc(getParticipantDocId(eventId, userId));
        let updatedEvent = null;
        let updatedParticipant = null;
        let newlyFinalized = false;
        await firebase_1.db.runTransaction(async (tx) => {
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
                ...participantSnap.data(),
            };
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
            }
            else {
                votesSubmittedCount += 1;
            }
            voteTotals[venueOptionId] = (voteTotals[venueOptionId] || 0) + 1;
            const participantStatuses = eventData.participantStatuses || {};
            const joinedCount = Object.values(participantStatuses).filter((status) => status === 'joined').length;
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
            tx.set(participantRef, {
                voteVenueOptionId: venueOptionId,
                voteSubmittedAt: now,
                lastStatusAt: now,
            }, { merge: true });
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
                ? { id: refreshedSnap.id, ...refreshedSnap.data() }
                : updatedEvent;
            const participantStatuses = refreshedEvent.participantStatuses || {};
            const joinedParticipantIds = Object.entries(participantStatuses)
                .filter(([, status]) => status === 'joined')
                .map(([id]) => id);
            const finalVenue = extractVenue(refreshedEvent, refreshedEvent.finalVenueOptionId || updatedEvent.finalVenueOptionId);
            const chatRoomId = await group_chat_service_1.GroupChatService.createOrUpdateChatForEvent(refreshedEvent, joinedParticipantIds, finalVenue);
            await eventRef.update({
                chatRoomId,
                status: 'ready',
                confirmationsReceived: refreshedEvent.confirmationsReceived || 0,
                updatedAt: firestore_1.Timestamp.now(),
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
    static async respondToReminder(eventId, user, action) {
        if (action === 'cancel') {
            return this.cancelParticipation(eventId, user);
        }
        const now = firestore_1.Timestamp.now();
        const eventRef = firebase_1.db.collection(firebase_1.Collections.EVENTS).doc(eventId);
        const participantRef = firebase_1.db.collection(firebase_1.Collections.EVENT_PARTICIPANTS).doc(getParticipantDocId(eventId, user.id));
        const userRef = firebase_1.db.collection(firebase_1.Collections.USERS).doc(user.id);
        let updatedEvent = null;
        let updatedParticipant = null;
        await firebase_1.db.runTransaction(async (tx) => {
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
                ...participantSnap.data(),
            };
            const participantStatuses = eventData.participantStatuses || {};
            const currentStatus = participantStatuses[user.id];
            if (!currentStatus || (currentStatus !== 'joined' && currentStatus !== 'confirmed')) {
                throw new Error('You are not able to confirm for this event.');
            }
            participantStatuses[user.id] = 'confirmed';
            const confirmations = Object.values(participantStatuses).filter((status) => status === 'confirmed').length;
            const activeStatuses = Object.values(participantStatuses).filter((status) => status !== 'canceled' && status !== 'removed');
            const allConfirmed = activeStatuses.length > 0 &&
                activeStatuses.every((status) => status === 'confirmed' || status === 'completed');
            const newStatus = allConfirmed ? 'confirmed' : eventData.status;
            tx.update(eventRef, {
                participantStatuses,
                confirmationsReceived: confirmations,
                status: newStatus,
                updatedAt: now,
            });
            const userData = userSnap.exists ? userSnap.data() : undefined;
            const assignments = upsertPendingAssignment(userData?.pendingEvents, eventId, normalizeEventType(eventData), 'confirmed', now);
            tx.update(userRef, {
                pendingEvents: assignments,
                pendingEventCount: assignments.length,
            });
            tx.set(participantRef, {
                status: 'confirmed',
                confirmedAt: now,
                lastStatusAt: now,
            }, { merge: true });
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
    static async cancelParticipation(eventId, user) {
        const now = firestore_1.Timestamp.now();
        const eventRef = firebase_1.db.collection(firebase_1.Collections.EVENTS).doc(eventId);
        const participantRef = firebase_1.db.collection(firebase_1.Collections.EVENT_PARTICIPANTS).doc(getParticipantDocId(eventId, user.id));
        const userRef = firebase_1.db.collection(firebase_1.Collections.USERS).doc(user.id);
        let updatedEvent = null;
        let updatedParticipant = null;
        let pairMatchIdToReset = null;
        let otherUserId = null;
        let eventTypeForReplacement = null;
        await firebase_1.db.runTransaction(async (tx) => {
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
                ...participantSnap.data(),
            };
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
                const pairRef = firebase_1.db.collection(firebase_1.Collections.PAIR_MATCHES).doc(pairId);
                const pairSnap = await tx.get(pairRef);
                if (pairSnap.exists) {
                    const pairData = pairSnap.data();
                    if (Array.isArray(pairData.userIds) && pairData.userIds.includes(user.id)) {
                        pairMatchIdToReset = pairSnap.id;
                        otherUserId = pairData.userIds.find((id) => id !== user.id) || null;
                        break;
                    }
                }
            }
            let participantUserIds = (eventData.participantUserIds || []).filter((id) => id !== user.id);
            participantStatuses[user.id] = 'canceled';
            let otherAssignments = [];
            let otherJoinedEvents = [];
            let otherParticipantVoteOption = null;
            if (otherUserId) {
                participantUserIds = participantUserIds.filter((id) => id !== otherUserId);
                participantStatuses[otherUserId] = 'removed';
                const otherUserRef = firebase_1.db.collection(firebase_1.Collections.USERS).doc(otherUserId);
                const otherUserSnap = await tx.get(otherUserRef);
                if (otherUserSnap.exists) {
                    const otherUserData = otherUserSnap.data();
                    otherAssignments = upsertPendingAssignment(otherUserData.pendingEvents, eventId, normalizeEventType(eventData), 'canceled', now);
                    const joinedSet = new Set(otherUserData.joinedEvents || []);
                    joinedSet.delete(eventId);
                    otherJoinedEvents = Array.from(joinedSet);
                    tx.update(otherUserRef, {
                        pendingEvents: otherAssignments,
                        pendingEventCount: otherAssignments.length,
                        joinedEvents: otherJoinedEvents,
                    });
                }
                const otherParticipantRef = firebase_1.db
                    .collection(firebase_1.Collections.EVENT_PARTICIPANTS)
                    .doc(getParticipantDocId(eventId, otherUserId));
                const otherParticipantSnap = await tx.get(otherParticipantRef);
                if (otherParticipantSnap.exists) {
                    const otherParticipant = otherParticipantSnap.data();
                    otherParticipantVoteOption = otherParticipant.voteVenueOptionId || null;
                    tx.set(otherParticipantRef, {
                        status: 'removed',
                        lastStatusAt: now,
                    }, { merge: true });
                }
            }
            if (otherParticipantVoteOption) {
                voteTotals[otherParticipantVoteOption] = Math.max(0, (voteTotals[otherParticipantVoteOption] || 0) - 1);
                votesSubmittedCount = Math.max(0, votesSubmittedCount - 1);
            }
            const pendingPairMatchIds = pairMatchIdToReset
                ? (eventData.pendingPairMatchIds || []).filter((id) => id !== pairMatchIdToReset)
                : eventData.pendingPairMatchIds || [];
            const confirmations = Object.values(participantStatuses).filter((status) => status === 'confirmed').length;
            const activeStatuses = Object.values(participantStatuses).filter((status) => status !== 'canceled' && status !== 'removed');
            const allConfirmed = activeStatuses.length > 0 &&
                activeStatuses.every((status) => status === 'confirmed' || status === 'completed');
            let newEventStatus = eventData.status;
            if (activeStatuses.length === 0) {
                newEventStatus = 'pending_join';
            }
            else if (allConfirmed) {
                newEventStatus = 'confirmed';
            }
            else if (eventData.finalVenueOptionId) {
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
            const userData = userSnap.exists ? userSnap.data() : undefined;
            const normalizedType = normalizeEventType(eventData);
            const userAssignments = upsertPendingAssignment(userData?.pendingEvents, eventId, normalizedType, 'canceled', now);
            const joinedEventsSet = new Set(userData?.joinedEvents || []);
            joinedEventsSet.delete(eventId);
            let cancelCount = (userData?.eventCancelCount ?? 0) + 1;
            let banUntilTimestamp = userData?.eventBanUntil ?? null;
            if (cancelCount >= 3) {
                const banUntilDate = new Date();
                banUntilDate.setDate(banUntilDate.getDate() + 7);
                banUntilTimestamp = firestore_1.Timestamp.fromDate(banUntilDate);
                cancelCount = 0;
            }
            tx.update(userRef, {
                pendingEvents: userAssignments,
                pendingEventCount: userAssignments.length,
                joinedEvents: Array.from(joinedEventsSet),
                eventCancelCount: cancelCount,
                eventBanUntil: banUntilTimestamp,
            });
            tx.set(participantRef, {
                status: 'canceled',
                canceledAt: now,
                lastStatusAt: now,
            }, { merge: true });
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
            await firebase_1.db.collection(firebase_1.Collections.PAIR_MATCHES).doc(pairMatchIdToReset).update({
                queueStatus: 'sidelined',
                status: 'inactive',
                pendingEventId: null,
                updatedAt: firestore_1.Timestamp.now(),
            });
        }
        if (eventTypeForReplacement) {
            await event_orchestration_service_1.EventOrchestrationService.fillEventVacancies(eventId);
        }
        return { event: updatedEvent, participant: updatedParticipant };
    }
}
exports.EventParticipationService = EventParticipationService;
//# sourceMappingURL=event-participation.service.js.map