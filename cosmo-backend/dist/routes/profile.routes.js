"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileRoutes = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const profile_controller_1 = require("../controllers/profile.controller");
const validation_middleware_1 = require("../middleware/validation.middleware");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// Configure multer for photo uploads
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    },
});
// Validation schemas
const updateProfileSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(50),
    age: joi_1.default.number().min(18).max(100),
    bio: joi_1.default.string().max(500),
    gender: joi_1.default.string().valid('male', 'female', 'other'),
    interests: joi_1.default.array().items(joi_1.default.string()),
    lookingFor: joi_1.default.array().items(joi_1.default.string().valid('male', 'female', 'other')),
    photos: joi_1.default.array().items(joi_1.default.string().uri()),
    location: joi_1.default.object({
        lat: joi_1.default.number().min(-90).max(90),
        lng: joi_1.default.number().min(-180).max(180),
    }),
    radius: joi_1.default.number().min(1).max(100),
    traits: joi_1.default.any(), // Allow traits object for personality traits
});
const updateLocationSchema = joi_1.default.object({
    latitude: joi_1.default.number().min(-90).max(90).required(),
    longitude: joi_1.default.number().min(-180).max(180).required(),
    city: joi_1.default.string(),
    country: joi_1.default.string(),
});
const updateInterestsSchema = joi_1.default.object({
    interests: joi_1.default.array().items(joi_1.default.string()).min(3).max(20).required(),
});
// Routes
router.get('/me', profile_controller_1.ProfileController.getMyProfile);
router.put('/', (0, validation_middleware_1.validateRequest)(updateProfileSchema), profile_controller_1.ProfileController.updateProfile);
router.put('/location', (0, validation_middleware_1.validateRequest)(updateLocationSchema), profile_controller_1.ProfileController.updateLocation);
router.put('/interests', (0, validation_middleware_1.validateRequest)(updateInterestsSchema), profile_controller_1.ProfileController.updateInterests);
router.post('/photo', upload.single('photo'), profile_controller_1.ProfileController.uploadPhoto);
router.delete('/photo', profile_controller_1.ProfileController.deletePhoto);
router.post('/fix-photos', profile_controller_1.ProfileController.fixPhotoUrls);
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
exports.profileRoutes = router;
//# sourceMappingURL=profile.routes.js.map