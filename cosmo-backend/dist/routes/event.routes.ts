import { Router } from 'express';
import { EventController } from '../controllers/event.controller';
import { requireCompleteProfile, requireActiveSubscription } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas
const createEventSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().min(10).max(1000).required(),
  category: Joi.string().valid('food', 'music', 'sports', 'art', 'games', 'other').required(),
  venue_name: Joi.string().required(),
  venue_address: Joi.string().required(),
  starts_at: Joi.date().iso().greater('now').required(),
  duration_minutes: Joi.number().min(30).max(480).required(),
  capacity: Joi.number().min(4).max(50).required(),
  min_age: Joi.number().min(18).max(100),
  max_age: Joi.number().min(18).max(100),
  price: Joi.number().min(0).max(500),
  photos: Joi.array().items(Joi.string().uri()).max(5),
});

const joinEventSchema = Joi.object({
  preferences: Joi.object({
    genderPreference: Joi.array().items(Joi.string().valid('male', 'female', 'other')),
    ageRange: Joi.object({
      min: Joi.number().min(18),
      max: Joi.number().max(100),
    }),
  }),
});

const getEventsSchema = Joi.object({
  category: Joi.string().valid('food', 'music', 'sports', 'art', 'games', 'other'),
  date_from: Joi.date().iso(),
  date_to: Joi.date().iso(),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  radius_km: Joi.number().min(1).max(100),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(50).default(10),
});

// Routes
router.get(
  '/',
  validateRequest(getEventsSchema, 'query'),
  EventController.getEvents
);

router.get(
  '/recommended',
  EventController.getRecommendedEvents
);

router.get(
  '/my-events',
  EventController.getMyEvents
);

router.get(
  '/:id',
  EventController.getEvent
);

router.post(
  '/',
  requireCompleteProfile,
  validateRequest(createEventSchema),
  EventController.createEvent
);

router.put(
  '/:id',
  EventController.updateEvent
);

router.delete(
  '/:id',
  EventController.cancelEvent
);

router.post(
  '/:id/join',
  requireCompleteProfile,
  requireActiveSubscription,
  validateRequest(joinEventSchema),
  EventController.joinEvent
);

router.delete(
  '/:id/leave',
  EventController.leaveEvent
);

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

export const eventRoutes = router;