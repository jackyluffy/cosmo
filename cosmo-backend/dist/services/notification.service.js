"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const firebase_1 = __importDefault(require("../config/firebase"));
const firebase_2 = require("../config/firebase");
const logger_1 = require("../utils/logger");
const firestore_1 = require("firebase-admin/firestore");
const MAX_TOKENS_PER_BATCH = 500;
class NotificationService {
    static async fetchUserTarget(userId) {
        try {
            const userSnap = await firebase_2.db.collection(firebase_2.Collections.USERS).doc(userId).get();
            if (!userSnap.exists) {
                return { tokens: [], pushEnabled: false };
            }
            const userData = userSnap.data();
            const pushEnabled = userData?.preferences?.notifications?.push !== false;
            const tokens = userData?.notificationTokens || userData?.deviceTokens;
            if (Array.isArray(tokens)) {
                const filtered = tokens.filter((token) => typeof token === 'string' && token.trim().length > 0);
                return { tokens: filtered, pushEnabled };
            }
            // Check sub-collection `devices` for tokens if present
            const devicesSnap = await firebase_2.db
                .collection(firebase_2.Collections.USERS)
                .doc(userId)
                .collection('devices')
                .get();
            const deviceTokens = [];
            devicesSnap.forEach((doc) => {
                const data = doc.data();
                if (typeof data?.token === 'string' && data.token.trim().length > 0) {
                    deviceTokens.push(data.token);
                }
            });
            return { tokens: deviceTokens, pushEnabled };
        }
        catch (error) {
            logger_1.logger.warn('[NotificationService] Failed to fetch user tokens', { userId, error });
            return { tokens: [], pushEnabled: false };
        }
    }
    static chunkTokens(tokens) {
        const chunks = [];
        for (let i = 0; i < tokens.length; i += MAX_TOKENS_PER_BATCH) {
            chunks.push(tokens.slice(i, i + MAX_TOKENS_PER_BATCH));
        }
        return chunks;
    }
    static sanitizeData(data = {}) {
        const result = {};
        Object.entries(data).forEach(([key, value]) => {
            if (value === undefined || value === null) {
                return;
            }
            result[key] = String(value);
        });
        return result;
    }
    static async dispatchPush(tokens, payload, options) {
        if (tokens.length === 0) {
            return;
        }
        const messaging = firebase_1.default.messaging();
        const data = this.sanitizeData(payload.data);
        const batches = this.chunkTokens(tokens);
        await Promise.all(batches.map(async (batch) => {
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
                    logger_1.logger.warn('[NotificationService] Partial push failure', {
                        type: options.type,
                        userId: options.userId,
                        successCount: response.successCount,
                        failureCount: response.failureCount,
                    });
                }
            }
            catch (error) {
                logger_1.logger.error('[NotificationService] Push dispatch failed', {
                    type: options.type,
                    userId: options.userId,
                    error,
                });
            }
        }));
    }
    static async persistNotification(payload, options) {
        try {
            await firebase_2.db.collection(firebase_2.Collections.NOTIFICATIONS).add({
                userId: options.userId,
                type: options.type,
                title: payload.title,
                body: payload.body,
                data: this.sanitizeData(payload.data),
                read: false,
                createdAt: firestore_1.Timestamp.now(),
            });
        }
        catch (error) {
            logger_1.logger.error('[NotificationService] Failed to persist in-app notification', {
                type: options.type,
                userId: options.userId,
                error,
            });
        }
    }
    static async dispatch(payload, options) {
        const target = await this.fetchUserTarget(options.userId);
        await Promise.all([
            this.persistNotification(payload, options),
            target.pushEnabled ? this.dispatchPush(target.tokens, payload, options) : Promise.resolve(),
        ]);
    }
    static async sendEventReminder(userId, payload) {
        await this.dispatch(payload, { userId, type: 'event_reminder' });
    }
    static async sendGroupFormed(userId, payload) {
        await this.dispatch(payload, { userId, type: 'group_formed' });
    }
    static async sendChatMessage(userId, payload) {
        await this.dispatch(payload, { userId, type: 'chat_message' });
    }
}
exports.NotificationService = NotificationService;
// TODO: support in-app toast vs. push logic depending on user preferences.
//# sourceMappingURL=notification.service.js.map