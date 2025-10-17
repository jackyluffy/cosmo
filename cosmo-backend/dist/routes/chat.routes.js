"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRoutes = void 0;
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const validation_middleware_1 = require("../middleware/validation.middleware");
const chat_controller_1 = require("../controllers/chat.controller");
const router = (0, express_1.Router)();
const sendMessageSchema = joi_1.default.object({
    message: joi_1.default.string().min(1).max(1000).required(),
    attachments: joi_1.default.array()
        .items(joi_1.default.object({
        type: joi_1.default.string().valid('image', 'gif').required(),
        url: joi_1.default.string().uri().required(),
    }))
        .max(5),
});
const markAsReadSchema = joi_1.default.object({
    messageIds: joi_1.default.array().items(joi_1.default.string()).min(1).required(),
});
const getMessagesSchema = joi_1.default.object({
    limit: joi_1.default.number().min(1).max(200).default(50),
    before: joi_1.default.number().optional(),
});
router.get('/conversations', chat_controller_1.ChatController.getConversations);
router.get('/conversations/:conversationId/messages', (0, validation_middleware_1.validateRequest)(getMessagesSchema, 'query'), chat_controller_1.ChatController.getMessages);
router.post('/conversations/:conversationId/messages', (0, validation_middleware_1.validateRequest)(sendMessageSchema), chat_controller_1.ChatController.sendMessage);
router.put('/conversations/:conversationId/read', (0, validation_middleware_1.validateRequest)(markAsReadSchema), chat_controller_1.ChatController.markAsRead);
router.delete('/conversations/:conversationId/messages/:messageId', chat_controller_1.ChatController.deleteMessage);
exports.chatRoutes = router;
//# sourceMappingURL=chat.routes.js.map