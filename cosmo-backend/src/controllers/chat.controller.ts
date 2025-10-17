import { Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { ChatService } from '../services/chat.service';

const DEFAULT_LIMIT = 50;

export class ChatController {
  static async getConversations(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const chats = await ChatService.getUserChats(userId);
      return res.json({
        success: true,
        data: chats,
      });
    } catch (error: any) {
      console.error('getConversations error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to load conversations',
      });
    }
  }

  static async getMessages(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;
      const { limit = DEFAULT_LIMIT, before } = req.query;

      const chat = await ChatService.getChatById(conversationId);
      if (!chat.participantIds.includes(userId)) {
        return res.status(403).json({
          success: false,
          error: 'You are not part of this chat',
        });
      }

      const beforeTimestamp = before ? Timestamp.fromMillis(Number(before)) : undefined;
      const { messages, hasMore } = await ChatService.getMessages(
        conversationId,
        Number(limit),
        beforeTimestamp
      );

      return res.json({
        success: true,
        data: {
          chat,
          messages,
          hasMore,
        },
      });
    } catch (error: any) {
      console.error('getMessages error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to load messages',
      });
    }
  }

  static async sendMessage(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;
      const { message, attachments } = req.body;

      const chat = await ChatService.getChatById(conversationId);
      if (!chat.participantIds.includes(userId)) {
        return res.status(403).json({
          success: false,
          error: 'You are not part of this chat',
        });
      }

      const newMessage = await ChatService.sendMessage(
        conversationId,
        userId,
        message,
        attachments
      );

      return res.json({
        success: true,
        data: newMessage,
      });
    } catch (error: any) {
      console.error('sendMessage error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to send message',
      });
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;
      const { messageIds } = req.body;

      const chat = await ChatService.getChatById(conversationId);
      if (!chat.participantIds.includes(userId)) {
        return res.status(403).json({
          success: false,
          error: 'You are not part of this chat',
        });
      }

      const result = await ChatService.markAsRead(conversationId, userId, messageIds);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('markAsRead error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to mark messages as read',
      });
    }
  }

  static async deleteMessage(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const { conversationId, messageId } = req.params;

      const chat = await ChatService.getChatById(conversationId);
      if (!chat.participantIds.includes(userId)) {
        return res.status(403).json({
          success: false,
          error: 'You are not part of this chat',
        });
      }

      const result = await ChatService.deleteMessage(conversationId, messageId, userId);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('deleteMessage error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete message',
      });
    }
  }
}
