import { Router } from 'express';
import { validateRequest } from '../middleware/validation.middleware';
import { SwipeController } from '../controllers/swipe.controller';
import Joi from 'joi';

const router = Router();

// Validation schemas
const swipeSchema = Joi.object({
  direction: Joi.string().valid('like', 'skip').required(),
});

// Routes
router.get('/deck', SwipeController.getDeck);

router.post(
  '/:targetId',
  validateRequest(swipeSchema),
  SwipeController.swipe
);

router.get('/matches', SwipeController.getMatches);

router.delete('/matches/:matchId', SwipeController.unmatch);

export const swipeRoutes = router;