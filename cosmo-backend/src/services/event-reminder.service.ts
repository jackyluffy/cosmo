import { Timestamp } from 'firebase-admin/firestore';
import { db, Collections } from '../config/firebase';
import { Event } from '../types';
import { NotificationService } from './notification.service';

const HOURS_BEFORE_EVENT = 48;
const WINDOW_IN_HOURS = 2;

const hoursFromNow = (hours: number) => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
};

export class EventReminderService {
  static async sendUpcomingEventReminders(): Promise<{ processed: number }> {
    const windowStart = hoursFromNow(HOURS_BEFORE_EVENT);
    const windowEnd = hoursFromNow(HOURS_BEFORE_EVENT + WINDOW_IN_HOURS);

    const eventsSnapshot = await db
      .collection(Collections.EVENTS)
      .where('status', '==', 'ready')
      .where('reminderSent', '==', false)
      .where('date', '>=', Timestamp.fromDate(windowStart))
      .where('date', '<', Timestamp.fromDate(windowEnd))
      .get();

    if (eventsSnapshot.empty) {
      return { processed: 0 };
    }

    let processedCount = 0;

    for (const doc of eventsSnapshot.docs) {
      const event = { id: doc.id, ...doc.data() } as Event;
      const participantStatuses = event.participantStatuses || {};
      const joinedParticipants = Object.entries(participantStatuses)
        .filter(([, status]) => status === 'joined')
        .map(([userId]) => userId);

      const now = Timestamp.now();
      await Promise.all(
        joinedParticipants.map((userId) =>
          NotificationService.sendEventReminder(userId, {
            title: `48-hour reminder for ${event.title}`,
            body: `Confirm your spot for ${event.title}. Tap to view the final details.`,
            data: {
              eventId: event.id,
              eventType: event.eventType || 'unknown',
              venueId: event.finalVenueOptionId || 'unknown',
            },
          })
        )
      );

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
