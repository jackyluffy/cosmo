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
          interests,
        };
      });
    }

    return profiles;
  }

  static async getUserChats(userId: string): Promise<Array<ChatDocument & { participants: ChatParticipant[] }>> {
    const snapshot = await db
      .collection(Collections.GROUP_CHATS)
      .where('participantIds', 'array-contains', userId)
      .orderBy('updatedAt', 'desc')
      .get();

    const chats = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) })) as ChatDocument[];
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
    const chat = { id: chatSnap.id, ...(chatSnap.data() as any) } as ChatDocument;
    const profileMap = await this.loadParticipantProfiles(chat.participantIds || []);
    return {
      ...chat,
      participants: (chat.participantIds || [])
        .map((id) => profileMap[id])
        .filter((participant): participant is ChatParticipant => Boolean(participant)),
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
