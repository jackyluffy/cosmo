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
const availabilityEntrySchema = Joi.object({
  morning: Joi.boolean().optional(),
  afternoon: Joi.boolean().optional(),
  evening: Joi.boolean().optional(),
  night: Joi.boolean().optional(),
  blocked: Joi.boolean().optional(),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  age: Joi.number().min(18).max(100).optional(),
  bio: Joi.string().max(500).optional(),
  gender: Joi.string().valid('male', 'female', 'other', 'non-binary').optional(),
  genderPreference: Joi.string().valid('male', 'female', 'both').optional(),
  ethnicity: Joi.string().valid('Asian', 'Black', 'Hispanic', 'White', 'Mixed', 'Other').optional(),
  height: Joi.string().optional(), // e.g., "5'5\""
  occupation: Joi.string().max(100).optional(),
  socialMedia: Joi.object({
    platform: Joi.string().valid('instagram', 'wechat').required(),
    handle: Joi.string().max(50).required(),
  }).optional(),
  interests: Joi.array().items(Joi.string()).optional(),
  lookingFor: Joi.array().items(Joi.string().valid('male', 'female', 'other')).optional(),
  photos: Joi.array().items(Joi.string().uri()).optional(),
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
  }).optional(),
  radius: Joi.number().min(1).max(100).optional(),
  traits: Joi.any().optional(), // Allow traits object for personality traits
  availability: Joi.object().pattern(Joi.string().min(1), availabilityEntrySchema).optional(),
  verified: Joi.boolean().optional(),
  verificationDate: Joi.string().isoDate().optional(),
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
