"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const firestore_1 = require("firebase-admin/firestore");
const chat_service_1 = require("../services/chat.service");
const DEFAULT_LIMIT = 50;
class ChatController {
    static async getConversations(req, res) {
        try {
            const userId = req.userId;
            const chats = await chat_service_1.ChatService.getUserChats(userId);
            return res.json({
                success: true,
                data: chats,
            });
        }
        catch (error) {
            console.error('getConversations error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to load conversations',
            });
        }
    }
    static async getMessages(req, res) {
        try {
            const userId = req.userId;
            const { conversationId } = req.params;
            const { limit = DEFAULT_LIMIT, before } = req.query;
            const chat = await chat_service_1.ChatService.getChatById(conversationId);
            if (!chat.participantIds.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not part of this chat',
                });
            }
            const beforeTimestamp = before ? firestore_1.Timestamp.fromMillis(Number(before)) : undefined;
            const { messages, hasMore } = await chat_service_1.ChatService.getMessages(conversationId, Number(limit), beforeTimestamp);
            return res.json({
                success: true,
                data: {
                    chat,
                    messages,
                    hasMore,
                },
            });
        }
        catch (error) {
            console.error('getMessages error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to load messages',
            });
        }
    }
    static async sendMessage(req, res) {
        try {
            const userId = req.userId;
            const { conversationId } = req.params;
            const { message, attachments } = req.body;
            const chat = await chat_service_1.ChatService.getChatById(conversationId);
            if (!chat.participantIds.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not part of this chat',
                });
            }
            const newMessage = await chat_service_1.ChatService.sendMessage(conversationId, userId, message, attachments);
            return res.json({
                success: true,
                data: newMessage,
            });
        }
        catch (error) {
            console.error('sendMessage error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to send message',
            });
        }
    }
    static async markAsRead(req, res) {
        try {
            const userId = req.userId;
            const { conversationId } = req.params;
            const { messageIds } = req.body;
            const chat = await chat_service_1.ChatService.getChatById(conversationId);
            if (!chat.participantIds.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not part of this chat',
                });
            }
            const result = await chat_service_1.ChatService.markAsRead(conversationId, userId, messageIds);
            return res.json({ success: true, data: result });
        }
        catch (error) {
            console.error('markAsRead error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to mark messages as read',
            });
        }
    }
    static async deleteMessage(req, res) {
        try {
            const userId = req.userId;
            const { conversationId, messageId } = req.params;
            const chat = await chat_service_1.ChatService.getChatById(conversationId);
            if (!chat.participantIds.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not part of this chat',
                });
            }
            const result = await chat_service_1.ChatService.deleteMessage(conversationId, messageId, userId);
            return res.json({ success: true, data: result });
        }
        catch (error) {
            console.error('deleteMessage error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to delete message',
            });
        }
    }
}
exports.ChatController = ChatController;
//# sourceMappingURL=chat.controller.js.map