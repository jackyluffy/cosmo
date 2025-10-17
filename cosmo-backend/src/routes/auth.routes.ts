import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas
const requestOTPSchema = Joi.object({
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
  email: Joi.string().email(),
}).xor('phone', 'email');

const verifyOTPSchema = Joi.object({
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
  email: Joi.string().email(),
  code: Joi.string().length(6).required(),
}).xor('phone', 'email');

// Routes
router.post(
  '/otp/request',
  validateRequest(requestOTPSchema),
  AuthController.requestOTP
);

router.post(
  '/otp/verify',
  validateRequest(verifyOTPSchema),
  AuthController.verifyOTP
);

router.post(
  '/validate',
  authenticate,
  AuthController.validateToken
);

router.post(
  '/logout',
  authenticate,
  AuthController.logout
);

router.post(
  '/refresh',
  AuthController.refreshToken
);

// OAuth validation schemas
const googleAuthSchema = Joi.object({
  idToken: Joi.string().required(),
});

const appleAuthSchema = Joi.object({
  identityToken: Joi.string().required(),
  user: Joi.alternatives()
    .try(
      Joi.object({
        id: Joi.string().optional(),
        user: Joi.string().optional(),
        email: Joi.string().email().optional(),
        fullName: Joi.object({
          givenName: Joi.string().allow('', null),
          familyName: Joi.string().allow('', null),
          middleName: Joi.string().allow('', null),
          nickname: Joi.string().allow('', null),
          namePrefix: Joi.string().allow('', null),
          nameSuffix: Joi.string().allow('', null),
        }).optional(),
      }).unknown(true),
      Joi.string()
    )
    .optional(),
});

// OAuth routes
router.post(
  '/google',
  validateRequest(googleAuthSchema),
  AuthController.googleAuth
);

router.post(
  '/apple',
  validateRequest(appleAuthSchema),
  AuthController.appleAuth
);

export const authRoutes = router;
