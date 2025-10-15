"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventRoutes = void 0;
const express_1 = require("express");
const event_controller_1 = require("../controllers/event.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// Validation schemas
const createEventSchema = joi_1.default.object({
    title: joi_1.default.string().min(3).max(100).required(),
    description: joi_1.default.string().min(10).max(1000).required(),
    category: joi_1.default.string().valid('food', 'music', 'sports', 'art', 'games', 'other').required(),
    venue_name: joi_1.default.string().required(),
    venue_address: joi_1.default.string().required(),
    starts_at: joi_1.default.date().iso().greater('now').required(),
    duration_minutes: joi_1.default.number().min(30).max(480).required(),
    capacity: joi_1.default.number().min(4).max(50).required(),
    min_age: joi_1.default.number().min(18).max(100),
    max_age: joi_1.default.number().min(18).max(100),
    price: joi_1.default.number().min(0).max(500),
    photos: joi_1.default.array().items(joi_1.default.string().uri()).max(5),
});
const joinEventSchema = joi_1.default.object({
    preferences: joi_1.default.object({
        genderPreference: joi_1.default.array().items(joi_1.default.string().valid('male', 'female', 'other')),
        ageRange: joi_1.default.object({
            min: joi_1.default.number().min(18),
            max: joi_1.default.number().max(100),
        }),
    }),
});
const getEventsSchema = joi_1.default.object({
    category: joi_1.default.string().valid('food', 'music', 'sports', 'art', 'games', 'other'),
    date_from: joi_1.default.date().iso(),
    date_to: joi_1.default.date().iso(),
    latitude: joi_1.default.number().min(-90).max(90),
    longitude: joi_1.default.number().min(-180).max(180),
    radius_km: joi_1.default.number().min(1).max(100),
    page: joi_1.default.number().min(1).default(1),
    limit: joi_1.default.number().min(1).max(50).default(10),
});
// Routes
router.get('/', (0, validation_middleware_1.validateRequest)(getEventsSchema, 'query'), event_controller_1.EventController.getEvents);
router.get('/recommended', event_controller_1.EventController.getRecommendedEvents);
router.get('/my-events', event_controller_1.EventController.getMyEvents);
router.get('/:id', event_controller_1.EventController.getEvent);
router.post('/', auth_middleware_1.requireCompleteProfile, (0, validation_middleware_1.validateRequest)(createEventSchema), event_controller_1.EventController.createEvent);
router.put('/:id', event_controller_1.EventController.updateEvent);
router.delete('/:id', event_controller_1.EventController.cancelEvent);
router.post('/:id/join', auth_middleware_1.requireCompleteProfile, auth_middleware_1.requireActiveSubscription, (0, validation_middleware_1.validateRequest)(joinEventSchema), event_controller_1.EventController.joinEvent);
router.delete('/:id/leave', event_controller_1.EventController.leaveEvent);
// TODO: Implement these methods in EventController
// router.get(
//   '/:id/group',
//   EventController.getEventGroup
// );
// router.get(
//   '/:id/chat',
//   EventController.getEventChat
// );
// router.post(
//   '/:id/message',
//   EventController.sendEventMessage
// );
exports.eventRoutes = router;
//# sourceMappingURL=event.routes.js.map