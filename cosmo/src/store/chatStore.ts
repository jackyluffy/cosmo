import { create } from 'zustand';
import { realAPI } from '../services/api';

type Attachment = {
  type: string;
  url: string;
};

export interface ChatParticipant {
  id: string;
  name: string;
  age?: number;
  bio?: string;
  photo?: string | null;
  photos?: string[];
  interests?: string[];
}

export interface ChatSummary {
  id: string;
  eventId: string;
  title: string;
  eventType?: string | null;
  participantIds: string[];
  participants?: ChatParticipant[];
  venue?: any;
  suggestedTimes?: any[];
  lastMessage?: string | null;
  lastSenderId?: string | null;
  lastMessageAt?: string | null;
  updatedAt?: string | null;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  eventId: string;
  senderId: string;
  content: string;
  attachments?: Attachment[];
  createdAt: string;
  readBy: string[];
  deletedAt?: string;
}

type MessagesState = Record<string, ChatMessage[]>;

type LoadingMap = Record<string, boolean>;

type ChatState = {
  chats: Record<string, ChatSummary>;
  messages: MessagesState;
  loadingChats: LoadingMap;
  loadingMessages: LoadingMap;
  sendingMessages: LoadingMap;
  error: string | null;
  fetchChat: (chatId: string) => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, message: string, attachments?: Attachment[]) => Promise<void>;
};

const normalizeTimestamps = (value: any): any => {
  if (!value || typeof value !== 'object') {
    return value;
  }
  // Handle Firestore Timestamp with toDate method
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  // Handle Firestore Timestamp JSON format (_seconds, _nanoseconds)
  if (value._seconds !== undefined && value._nanoseconds !== undefined) {
    return new Date(value._seconds * 1000 + value._nanoseconds / 1000000).toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeTimestamps);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [key, normalizeTimestamps(val)])
  );
};

export const useChatStore = create<ChatState>((set, get) => ({
  chats: {},
  messages: {},
  loadingChats: {},
  loadingMessages: {},
  sendingMessages: {},
  error: null,

  fetchChat: async (chatId: string) => {
    set((state) => ({
      loadingChats: { ...state.loadingChats, [chatId]: true },
      error: null,
    }));
    try {
      const response = await realAPI.chat.getMessages(chatId, { limit: 1 });
      const chat = normalizeTimestamps(response.data.data.chat);
      set((state) => ({
        chats: {
          ...state.chats,
          [chatId]: chat,
        },
        loadingChats: { ...state.loadingChats, [chatId]: false },
      }));
    } catch (error: any) {
      console.error('[chatStore] fetchChat error:', error);
      set((state) => ({
        loadingChats: { ...state.loadingChats, [chatId]: false },
        error: error?.response?.data?.error || error?.message || 'Failed to load chat',
      }));
      throw error;
    }
  },

  fetchMessages: async (chatId: string) => {
    set((state) => ({
      loadingMessages: { ...state.loadingMessages, [chatId]: true },
      error: null,
    }));
    try {
      const response = await realAPI.chat.getMessages(chatId);
      const normalizedMessages = (response.data.data.messages || []).map((message: any) =>
        normalizeTimestamps(message)
      );
      normalizedMessages.reverse();

      const normalizedChat = normalizeTimestamps(response.data.data.chat);
      console.log('[chatStore] Chat loaded:', {
        id: normalizedChat.id,
        participantsCount: normalizedChat.participants?.length || 0,
        messagesCount: normalizedMessages.length,
      });

      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: normalizedMessages,
        },
        chats: {
          ...state.chats,
          [chatId]: normalizedChat,
        },
        loadingMessages: { ...state.loadingMessages, [chatId]: false },
      }));
    } catch (error: any) {
      console.error('[chatStore] fetchMessages error:', error);
      set((state) => ({
        loadingMessages: { ...state.loadingMessages, [chatId]: false },
        error: error?.response?.data?.error || error?.message || 'Failed to load messages',
      }));
      throw error;
    }
  },

  sendMessage: async (chatId: string, message: string, attachments: Attachment[] = []) => {
    if (!message.trim()) {
      return;
    }
    set((state) => ({
      sendingMessages: { ...state.sendingMessages, [chatId]: true },
      error: null,
    }));
    try {
      const response = await realAPI.chat.sendMessage(chatId, { message, attachments });
      const normalizedMessage = normalizeTimestamps(response.data.data);

      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: [...(state.messages[chatId] || []), normalizedMessage],
        },
        sendingMessages: { ...state.sendingMessages, [chatId]: false },
      }));
    } catch (error: any) {
      console.error('[chatStore] sendMessage error:', error);
      set((state) => ({
        sendingMessages: { ...state.sendingMessages, [chatId]: false },
        error: error?.response?.data?.error || error?.message || 'Failed to send message',
      }));
      throw error;
    }
  },
}));
