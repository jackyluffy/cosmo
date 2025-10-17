import { Timestamp } from 'firebase-admin/firestore';
import { db, Collections } from '../config/firebase';
import { Event, EventVenueOption } from '../types';

interface ChatVenueSummary {
  id: string;
  name: string;
  address: string;
  description?: string;
  photos: string[];
  priceRange?: { min: number; max: number };
  durationMinutes?: number;
  additionalInfo?: string | null;
}

export class GroupChatService {
  static async createOrUpdateChatForEvent(
    event: Event,
    participantIds: string[],
    finalVenue?: EventVenueOption
  ): Promise<string> {
    const now = Timestamp.now();
    const venueSummary: ChatVenueSummary | null = finalVenue
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
      const chatRef = db.collection(Collections.GROUP_CHATS).doc(event.chatRoomId);
      await chatRef.set(
        {
          eventId: event.id,
          title: event.title,
          eventType: event.eventType || null,
          participantIds,
          venue: venueSummary,
          suggestedTimes: event.suggestedTimes || [],
          updatedAt: now,
        },
        { merge: true }
      );
      return event.chatRoomId;
    }

    const chatDoc = await db.collection(Collections.GROUP_CHATS).add({
      eventId: event.id,
      title: event.title,
      eventType: event.eventType || null,
      participantIds,
      venue: venueSummary,
      suggestedTimes: event.suggestedTimes || [],
      createdAt: now,
      updatedAt: now,
      lastMessageAt: null,
    });

    return chatDoc.id;
  }
}
