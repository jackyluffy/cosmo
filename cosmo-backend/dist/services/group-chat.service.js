"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupChatService = void 0;
const firestore_1 = require("firebase-admin/firestore");
const firebase_1 = require("../config/firebase");
class GroupChatService {
    static async createOrUpdateChatForEvent(event, participantIds, finalVenue) {
        const now = firestore_1.Timestamp.now();
        const uniqueParticipantIds = Array.from(new Set(participantIds.filter(Boolean)));
        const venueSummary = finalVenue
            ? {
                id: finalVenue.id,
                name: finalVenue.name,
                address: finalVenue.address,
                description: finalVenue.description,
                photos: finalVenue.photos || [],
                priceRange: finalVenue.priceRange,
                durationMinutes: finalVenue.durationMinutes,
                additionalInfo: finalVenue.additionalInfo ?? null,
            }
            : null;
        if (event.chatRoomId) {
            const chatRef = firebase_1.db.collection(firebase_1.Collections.GROUP_CHATS).doc(event.chatRoomId);
            await chatRef.set({
                eventId: event.id,
                title: event.title,
                eventType: event.eventType || null,
                participantIds: uniqueParticipantIds,
                venue: venueSummary,
                suggestedTimes: event.suggestedTimes || [],
                updatedAt: now,
            }, { merge: true });
            return event.chatRoomId;
        }
        const chatDoc = await firebase_1.db.collection(firebase_1.Collections.GROUP_CHATS).add({
            eventId: event.id,
            title: event.title,
            eventType: event.eventType || null,
            participantIds: uniqueParticipantIds,
            venue: venueSummary,
            suggestedTimes: event.suggestedTimes || [],
            createdAt: now,
            updatedAt: now,
            lastMessageAt: null,
        });
        return chatDoc.id;
    }
}
exports.GroupChatService = GroupChatService;
//# sourceMappingURL=group-chat.service.js.map