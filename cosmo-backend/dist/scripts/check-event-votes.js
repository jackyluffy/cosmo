#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = require("../config/firebase");
async function checkEvent() {
    const eventId = '18AqQAqck6zVChI9GIBZ';
    const eventDoc = await firebase_1.db.collection(firebase_1.Collections.EVENTS).doc(eventId).get();
    if (!eventDoc.exists) {
        console.log('Event not found');
        return;
    }
    const eventData = eventDoc.data();
    console.log('Event ID:', eventId);
    console.log('Title:', eventData?.title);
    console.log('\nParticipant Statuses:', JSON.stringify(eventData?.participantStatuses, null, 2));
    console.log('\nVenue Vote Totals:', JSON.stringify(eventData?.venueVoteTotals, null, 2));
    console.log('\nFinal Venue Option ID:', eventData?.finalVenueOptionId);
    console.log('Chat Room ID:', eventData?.chatRoomId);
    // Count active participants
    const statuses = eventData?.participantStatuses || {};
    const activeStatuses = Object.entries(statuses).filter(([_, status]) => status !== 'canceled' && status !== 'removed');
    console.log('\nActive Participants:', activeStatuses.length);
    activeStatuses.forEach(([userId, status]) => {
        console.log('  -', userId, ':', status);
    });
    // Check if chat room exists
    if (eventData?.chatRoomId) {
        const chatDoc = await firebase_1.db.collection(firebase_1.Collections.GROUP_CHATS).doc(eventData.chatRoomId).get();
        if (chatDoc.exists) {
            const chatData = chatDoc.data();
            console.log('\nChat Room Found:');
            console.log('  Participant IDs:', chatData?.participantIds);
            console.log('  Participants Count:', chatData?.participantIds?.length);
        }
        else {
            console.log('\nChat room does not exist!');
        }
    }
    else {
        console.log('\nNo chat room ID set on event');
    }
}
checkEvent()
    .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
})
    .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
//# sourceMappingURL=check-event-votes.js.map