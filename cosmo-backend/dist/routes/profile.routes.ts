import { Router } from 'express';
import multer from 'multer';
import { ProfileController } from '../controllers/profile.controller';
import { validateRequest } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// Configure multer for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Validation schemas
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(50),
  age: Joi.number().min(18).max(100),
  bio: Joi.string().max(500),
  gender: Joi.string().valid('male', 'female', 'other'),
  interests: Joi.array().items(Joi.string()),
  lookingFor: Joi.array().items(Joi.string().valid('male', 'female', 'other')),
  photos: Joi.array().items(Joi.string().uri()),
  location: Joi.object({
    lat: Joi.number().min(-90).max(90),
    lng: Joi.number().min(-180).max(180),
  }),
  radius: Joi.number().min(1).max(100),
  traits: Joi.any(), // Allow traits object for personality traits
});

const updateLocationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  city: Joi.string(),
  country: Joi.string(),
});

const updateInterestsSchema = Joi.object({
  interests: Joi.array().items(Joi.string()).min(3).max(20).required(),
});

// Routes
router.get('/me', ProfileController.getMyProfile);

router.put(
  '/',
  validateRequest(updateProfileSchema),
  ProfileController.updateProfile
);

router.put(
  '/location',
  validateRequest(updateLocationSchema),
  ProfileController.updateLocation
);

router.put(
  '/interests',
  validateRequest(updateInterestsSchema),
  ProfileController.updateInterests
);

router.post(
  '/photo',
  upload.single('photo'),
  ProfileController.uploadPhoto
);

router.delete(
  '/photo',
  ProfileController.deletePhoto
);

router.post(
  '/fix-photos',
  ProfileController.fixPhotoUrls
);

// TODO: Implement these methods in ProfileController
// router.post(
//   '/verify',
//   upload.single('selfie'),
//   ProfileController.verifyProfile
// );

// router.put(
//   '/preferences',
//   ProfileController.updatePreferences
// );

// router.put(
//   '/traits',
//   ProfileController.updateTraits
// );

export const profileRoutes = router;