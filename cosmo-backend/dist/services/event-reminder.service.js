"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventReminderService = void 0;
const firestore_1 = require("firebase-admin/firestore");
const firebase_1 = require("../config/firebase");
const notification_service_1 = require("./notification.service");
const HOURS_BEFORE_EVENT = 48;
const WINDOW_IN_HOURS = 2;
const hoursFromNow = (hours) => {
    const date = new Date();
    date.setHours(date.getHours() + hours);
    return date;
};
class EventReminderService {
    static async sendUpcomingEventReminders() {
        const windowStart = hoursFromNow(HOURS_BEFORE_EVENT);
        const windowEnd = hoursFromNow(HOURS_BEFORE_EVENT + WINDOW_IN_HOURS);
        const eventsSnapshot = await firebase_1.db
            .collection(firebase_1.Collections.EVENTS)
            .where('status', '==', 'ready')
            .where('reminderSent', '==', false)
            .where('date', '>=', firestore_1.Timestamp.fromDate(windowStart))
            .where('date', '<', firestore_1.Timestamp.fromDate(windowEnd))
            .get();
        if (eventsSnapshot.empty) {
            return { processed: 0 };
        }
        let processedCount = 0;
        for (const doc of eventsSnapshot.docs) {
            const event = { id: doc.id, ...doc.data() };
            const participantStatuses = event.participantStatuses || {};
            const joinedParticipants = Object.entries(participantStatuses)
                .filter(([, status]) => status === 'joined')
                .map(([userId]) => userId);
            const now = firestore_1.Timestamp.now();
            await Promise.all(joinedParticipants.map((userId) => notification_service_1.NotificationService.sendEventReminder(userId, {
                title: `48-hour reminder for ${event.title}`,
                body: `Confirm your spot for ${event.title}. Tap to view the final details.`,
                data: {
                    eventId: event.id,
                    eventType: event.eventType || 'unknown',
                    venueId: event.finalVenueOptionId || 'unknown',
                },
            })));
            await doc.ref.update({
                reminderSent: true,
                reminderSentAt: now,
                updatedAt: now,
            });
            processedCount += 1;
        }
        return { processed: processedCount };
    }
}
exports.EventReminderService = EventReminderService;
//# sourceMappingURL=event-reminder.service.js.map