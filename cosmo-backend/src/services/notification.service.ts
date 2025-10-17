import admin from '../config/firebase';
import { db, Collections } from '../config/firebase';
import { logger } from '../utils/logger';
import { Timestamp } from 'firebase-admin/firestore';

interface NotificationData {
  [key: string]: string | number | boolean | undefined | null;
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: NotificationData;
}

interface SendOptions {
  type: string;
  userId: string;
}

const MAX_TOKENS_PER_BATCH = 500;

interface NotificationTarget {
  tokens: string[];
  pushEnabled: boolean;
}

export class NotificationService {
  private static async fetchUserTarget(userId: string): Promise<NotificationTarget> {
    try {
      const userSnap = await db.collection(Collections.USERS).doc(userId).get();
      if (!userSnap.exists) {
        return { tokens: [], pushEnabled: false };
      }
      const userData = userSnap.data() as any;
      const pushEnabled = userData?.preferences?.notifications?.push !== false;
      const tokens: unknown = userData?.notificationTokens || userData?.deviceTokens;
      if (Array.isArray(tokens)) {
        const filtered = tokens.filter((token) => typeof token === 'string' && token.trim().length > 0);
        return { tokens: filtered, pushEnabled };
      }

      // Check sub-collection `devices` for tokens if present
      const devicesSnap = await db
        .collection(Collections.USERS)
        .doc(userId)
        .collection('devices')
        .get();

      const deviceTokens: string[] = [];
      devicesSnap.forEach((doc) => {
        const data = doc.data();
        if (typeof data?.token === 'string' && data.token.trim().length > 0) {
          deviceTokens.push(data.token);
        }
      });
      return { tokens: deviceTokens, pushEnabled };
    } catch (error) {
      logger.warn('[NotificationService] Failed to fetch user tokens', { userId, error });
      return { tokens: [], pushEnabled: false };
    }
  }

  private static chunkTokens(tokens: string[]): string[][] {
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += MAX_TOKENS_PER_BATCH) {
      chunks.push(tokens.slice(i, i + MAX_TOKENS_PER_BATCH));
    }
    return chunks;
  }

  private static sanitizeData(data: NotificationData = {}): Record<string, string> {
    const result: Record<string, string> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      result[key] = String(value);
    });
    return result;
  }

  private static async dispatchPush(
    tokens: string[],
    payload: NotificationPayload,
    options: SendOptions
  ): Promise<void> {
    if (tokens.length === 0) {
      return;
    }

    const messaging = admin.messaging();
    const data = this.sanitizeData(payload.data);
    const batches = this.chunkTokens(tokens);

    await Promise.all(
      batches.map(async (batch) => {
        try {
          const response = await messaging.sendEachForMulticast({
            tokens: batch,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data,
          });

          if (response.failureCount > 0) {
            logger.warn('[NotificationService] Partial push failure', {
              type: options.type,
              userId: options.userId,
              successCount: response.successCount,
              failureCount: response.failureCount,
            });
          }
        } catch (error) {
          logger.error('[NotificationService] Push dispatch failed', {
            type: options.type,
            userId: options.userId,
            error,
          });
        }
      })
    );
  }

  private static async persistNotification(
    payload: NotificationPayload,
    options: SendOptions
  ): Promise<void> {
    try {
      await db.collection(Collections.NOTIFICATIONS).add({
        userId: options.userId,
        type: options.type,
        title: payload.title,
        body: payload.body,
        data: this.sanitizeData(payload.data),
        read: false,
        createdAt: Timestamp.now(),
      });
    } catch (error) {
      logger.error('[NotificationService] Failed to persist in-app notification', {
        type: options.type,
        userId: options.userId,
        error,
      });
    }
  }

  private static async dispatch(
    payload: NotificationPayload,
    options: SendOptions
  ): Promise<void> {
    const target = await this.fetchUserTarget(options.userId);

    await Promise.all([
      this.persistNotification(payload, options),
      target.pushEnabled ? this.dispatchPush(target.tokens, payload, options) : Promise.resolve(),
    ]);
  }

  static async sendEventReminder(userId: string, payload: NotificationPayload): Promise<void> {
    await this.dispatch(payload, { userId, type: 'event_reminder' });
  }

  static async sendGroupFormed(userId: string, payload: NotificationPayload): Promise<void> {
    await this.dispatch(payload, { userId, type: 'group_formed' });
  }

  static async sendChatMessage(userId: string, payload: NotificationPayload): Promise<void> {
    await this.dispatch(payload, { userId, type: 'chat_message' });
  }
}
// TODO: support in-app toast vs. push logic depending on user preferences.
