import { FieldValue, FieldPath, Timestamp } from 'firebase-admin/firestore';
import { db, Collections } from '../config/firebase';
import { User, UserProfile } from '../types';

interface ChatDocument {
  id: string;
  eventId: string;
  title: string;
  eventType?: string | null;
  participantIds: string[];
  venue?: any;
  suggestedTimes?: any[];
  lastMessage?: string | null;
  lastSenderId?: string | null;
  lastMessageAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ChatParticipant {
  id: string;
  name: string;
  age?: number;
  bio?: string;
  photo?: string | null;
  photos?: string[];
  interests?: string[];
}

interface MessagePayload {
  chatId: string;
  eventId: string;
  senderId: string;
  content: string;
  attachments?: Array<{
    type: string;
    url: string;
  }>;
  createdAt: Timestamp;
  readBy: string[];
}

export class ChatService {
  private static readonly ACTIVE_PARTICIPANT_STATUSES = new Set([
    'pending_join',
    'joined',
    'confirmed',
    'completed',
  ]);

  private static async loadParticipantProfiles(
    participantIds: string[]
  ): Promise<Record<string, ChatParticipant>> {
    const uniqueIds = Array.from(new Set(participantIds)).filter(Boolean);
    if (uniqueIds.length === 0) {
      return {};
    }

    const profiles: Record<string, ChatParticipant> = {};
    const chunkSize = 10;
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize);
      const snapshot = await db
        .collection(Collections.USERS)
        .where(FieldPath.documentId(), 'in', chunk)
        .get();

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as User;
        const profile: UserProfile | undefined = data.profile;
        const interests = Array.isArray(profile?.interests)
          ? [...(profile?.interests as string[])]
          : [];

        profiles[doc.id] = {
          id: doc.id,
          name: profile?.name || 'Unknown',
          age: profile?.age,
          bio: profile?.bio,
          photo: profile?.photos?.[0] || null,
          photos: profile?.photos || [],
          interests,
        };
      });
    }

    return profiles;
  }

  private static extractActiveParticipantIds(eventData: any): string[] {
    const participantStatuses = eventData?.participantStatuses || {};

    const activeFromStatuses = Object.entries(participantStatuses)
      .filter(([, status]) => this.ACTIVE_PARTICIPANT_STATUSES.has(String(status)))
      .map(([id]) => id);

    const activeFromParticipants = Array.isArray(eventData?.participantUserIds)
      ? (eventData.participantUserIds as string[]).filter((id) => {
          if (!id) {
            return false;
          }
          const status = participantStatuses[id];
          if (!status) {
            // Assume active unless explicitly canceled/removed
            return true;
          }
          const statusStr = String(status);
          return statusStr !== 'canceled' && statusStr !== 'removed';
        })
      : [];

    return Array.from(new Set([...activeFromStatuses, ...activeFromParticipants]));
  }

  private static async ensureChatParticipantsUpToDate(chat: ChatDocument): Promise<ChatDocument> {
    if (!chat.eventId) {
      return chat;
    }

    try {
      const eventSnap = await db.collection(Collections.EVENTS).doc(chat.eventId).get();
      if (!eventSnap.exists) {
        return chat;
      }

      const eventData = eventSnap.data() as any;
      const expectedParticipantIds = this.extractActiveParticipantIds(eventData);
      if (expectedParticipantIds.length === 0) {
        return chat;
      }

      const currentParticipantIds = Array.isArray(chat.participantIds)
        ? chat.participantIds.filter(Boolean)
        : [];

      const hasDifference =
        expectedParticipantIds.length !== currentParticipantIds.length ||
        expectedParticipantIds.some((id) => !currentParticipantIds.includes(id));

      if (hasDifference) {
        console.log('[ChatService] Syncing chat participants:', {
          chatId: chat.id,
          currentCount: currentParticipantIds.length,
          expectedCount: expectedParticipantIds.length,
        });

        await db
          .collection(Collections.GROUP_CHATS)
          .doc(chat.id)
          .update({ participantIds: expectedParticipantIds });

        chat.participantIds = expectedParticipantIds;
      } else {
        chat.participantIds = currentParticipantIds;
      }
    } catch (error) {
      console.error('[ChatService] ensureChatParticipantsUpToDate error:', error);
    }

    return chat;
  }

  static async getUserChats(userId: string): Promise<Array<ChatDocument & { participants: ChatParticipant[] }>> {
    const snapshot = await db
      .collection(Collections.GROUP_CHATS)
      .where('participantIds', 'array-contains', userId)
      .orderBy('updatedAt', 'desc')
      .get();

    const chats = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const chat = { id: doc.id, ...(doc.data() as any) } as ChatDocument;
        return this.ensureChatParticipantsUpToDate(chat);
      })
    );

    const participantIds = chats.flatMap((chat) => chat.participantIds || []);
    const profileMap = await this.loadParticipantProfiles(participantIds);

    return chats.map((chat) => ({
      ...chat,
      participants: (chat.participantIds || [])
        .map((id) => profileMap[id])
        .filter((participant): participant is ChatParticipant => Boolean(participant)),
    }));
  }

  static async getChatById(chatId: string): Promise<ChatDocument & { participants: ChatParticipant[] }> {
    const chatSnap = await db.collection(Collections.GROUP_CHATS).doc(chatId).get();
    if (!chatSnap.exists) {
      throw new Error('Chat not found');
    }
    const chat = await this.ensureChatParticipantsUpToDate(
      { id: chatSnap.id, ...(chatSnap.data() as any) } as ChatDocument
    );
    console.log('[ChatService] getChatById:', {
      chatId,
      participantIds: chat.participantIds,
      participantIdsCount: chat.participantIds?.length,
    });

    const profileMap = await this.loadParticipantProfiles(chat.participantIds || []);
    console.log('[ChatService] Loaded profiles:', {
      profileMapKeys: Object.keys(profileMap),
      profileMapCount: Object.keys(profileMap).length,
    });

    const participants = (chat.participantIds || [])
      .map((id) => profileMap[id])
      .filter((participant): participant is ChatParticipant => Boolean(participant));

    console.log('[ChatService] Final participants:', {
      participantsCount: participants.length,
      participants: participants.map(p => ({ id: p.id, name: p.name, hasPhoto: !!p.photo })),
    });

    return {
      ...chat,
      participants,
    };
  }

  static async getMessages(
    chatId: string,
    limit = 50,
    before?: Timestamp
  ) {
    const chat = await this.getChatById(chatId);

    let query = db
      .collection(Collections.MESSAGES)
      .where('chatId', '==', chatId)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (before) {
      query = query.startAfter(before);
    }

    const snapshot = await query.get();
    const messages = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
    const hasMore = snapshot.size === limit;

    return { chat, messages, hasMore };
  }

  static async sendMessage(
    chatId: string,
    userId: string,
    content: string,
    attachments: MessagePayload['attachments'] = []
  ) {
    const chatRef = db.collection(Collections.GROUP_CHATS).doc(chatId);
    const chatSnap = await chatRef.get();
    if (!chatSnap.exists) {
      throw new Error('Chat not found');
    }

    const chatData = chatSnap.data() as any;
    if (!Array.isArray(chatData.participantIds) || !chatData.participantIds.includes(userId)) {
      throw new Error('You are not a participant of this chat');
    }

    const now = Timestamp.now();
    const messagePayload: MessagePayload = {
      chatId,
      eventId: chatData.eventId,
      senderId: userId,
      content,
      attachments,
      createdAt: now,
      readBy: [userId],
    };

    const messageDoc = await db.collection(Collections.MESSAGES).add(messagePayload);

    await chatRef.update({
      lastMessage: content,
      lastSenderId: userId,
      lastMessageAt: now,
      updatedAt: now,
    });

    return { id: messageDoc.id, ...messagePayload };
  }

  static async markAsRead(chatId: string, userId: string, messageIds: string[]) {
    const updates = messageIds.map((messageId) =>
      db
        .collection(Collections.MESSAGES)
        .doc(messageId)
        .update({ readBy: FieldValue.arrayUnion(userId) })
    );

    await Promise.all(updates);

    return { chatId, userId, updated: messageIds.length };
  }

  static async deleteMessage(chatId: string, messageId: string, userId: string) {
    const messageRef = db.collection(Collections.MESSAGES).doc(messageId);
    const messageSnap = await messageRef.get();
    if (!messageSnap.exists) {
      throw new Error('Message not found');
    }

    const messageData = messageSnap.data() as any;
    if (messageData.chatId !== chatId) {
      throw new Error('Message does not belong to this chat');
    }

    if (messageData.senderId !== userId) {
      throw new Error('Only the sender can delete a message');
    }

    await messageRef.update({ deletedAt: Timestamp.now() });

    const chatRef = db.collection(Collections.GROUP_CHATS).doc(chatId);
    const chatSnap = await chatRef.get();
    if (chatSnap.exists) {
      const chatData = chatSnap.data() as any;
      if (chatData.lastMessageAt && chatData.lastMessageAt.toDate) {
        const lastMessageAt = chatData.lastMessageAt.toDate();
        const deletedAt = messageData.createdAt?.toDate?.();
        if (deletedAt && deletedAt.getTime() === lastMessageAt.getTime()) {
          const lastMessageSnapshot = await db
            .collection(Collections.MESSAGES)
            .where('chatId', '==', chatId)
            .where('deletedAt', '==', null)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

          if (lastMessageSnapshot.empty) {
            await chatRef.update({
              lastMessage: null,
              lastSenderId: null,
              lastMessageAt: null,
            });
          } else {
            const lastMsg = lastMessageSnapshot.docs[0].data();
            await chatRef.update({
              lastMessage: lastMsg.content,
              lastSenderId: lastMsg.senderId,
              lastMessageAt: lastMsg.createdAt,
            });
          }
        }
      }
    }

    return { messageId, deleted: true };
  }
}
