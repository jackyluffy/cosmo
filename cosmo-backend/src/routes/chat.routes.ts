import { Router } from 'express';
import Joi from 'joi';
import { validateRequest } from '../middleware/validation.middleware';
import { ChatController } from '../controllers/chat.controller';

const router = Router();

const sendMessageSchema = Joi.object({
  message: Joi.string().min(1).max(1000).required(),
  attachments: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().valid('image', 'gif').required(),
        url: Joi.string().uri().required(),
      })
    )
    .max(5),
});

const markAsReadSchema = Joi.object({
  messageIds: Joi.array().items(Joi.string()).min(1).required(),
});

const getMessagesSchema = Joi.object({
  limit: Joi.number().min(1).max(200).default(50),
  before: Joi.number().optional(),
});

router.get('/conversations', ChatController.getConversations);

router.get(
  '/conversations/:conversationId/messages',
  validateRequest(getMessagesSchema, 'query'),
  ChatController.getMessages
);

router.post(
  '/conversations/:conversationId/messages',
  validateRequest(sendMessageSchema),
  ChatController.sendMessage
);

router.put(
  '/conversations/:conversationId/read',
  validateRequest(markAsReadSchema),
  ChatController.markAsRead
);

router.delete(
  '/conversations/:conversationId/messages/:messageId',
  ChatController.deleteMessage
);

export const chatRoutes = router;
