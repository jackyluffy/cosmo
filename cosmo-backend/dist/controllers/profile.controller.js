"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileController = void 0;
const firebase_1 = require("../config/firebase");
const firestore_1 = require("firebase-admin/firestore");
const storage_service_1 = require("../services/storage.service");
class ProfileController {
    /**
     * Get current user profile
     * GET /profile/me
     */
    static async getMyProfile(req, res) {
        try {
            const user = req.user;
            // Convert GeoPoint to plain object for JSON serialization
            const profile = user.profile ? { ...user.profile } : undefined;
            if (profile?.location?._latitude !== undefined) {
                console.log('[Get Profile] Converting GeoPoint to {lat, lng}');
                profile.location = {
                    lat: profile.location._latitude,
                    lng: profile.location._longitude,
                };
            }
            return res.status(200).json({
                success: true,
                data: {
                    id: user.id,
                    phone: user.phone,
                    email: user.email,
                    profile,
                    subscription: user.subscription,
                    preferences: user.preferences,
                },
            });
        }
        catch (error) {
            console.error('Get profile error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch profile',
            });
        }
    }
    /**
     * Update user profile
     * PUT /profile
     */
    static async updateProfile(req, res) {
        try {
            const userId = req.userId;
            const updates = req.body;
            console.log('[Profile Update] Received updates:', JSON.stringify(updates, null, 2));
            // Validate age if provided
            if (updates.age !== undefined) {
                if (updates.age < 18 || updates.age > 100) {
                    return res.status(400).json({
                        success: false,
                        error: 'Age must be between 18 and 100',
                    });
                }
            }
            // Prepare profile updates
            const profileUpdates = {};
            if (updates.name)
                profileUpdates['profile.name'] = updates.name;
            if (updates.age)
                profileUpdates['profile.age'] = updates.age;
            if (updates.height)
                profileUpdates['profile.height'] = updates.height;
            if (updates.gender)
                profileUpdates['profile.gender'] = updates.gender;
            if (updates.genderPreference)
                profileUpdates['profile.genderPreference'] = updates.genderPreference;
            if (updates.bio)
                profileUpdates['profile.bio'] = updates.bio;
            if (updates.interests)
                profileUpdates['profile.interests'] = updates.interests;
            if (updates.traits)
                profileUpdates['profile.traits'] = updates.traits;
            if (updates.radius)
                profileUpdates['profile.radius'] = updates.radius;
            if (updates.photos)
                profileUpdates['profile.photos'] = updates.photos;
            if (updates.location) {
                console.log('[Profile Update] Creating GeoPoint from:', updates.location);
                profileUpdates['profile.location'] = new firestore_1.GeoPoint(updates.location.lat, updates.location.lng);
                console.log('[Profile Update] GeoPoint created:', profileUpdates['profile.location']);
            }
            // Check if profile is being completed for the first time
            const userDoc = await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).get();
            const userData = userDoc.data();
            const isFirstCompletion = !userData?.profile?.completedAt;
            if (isFirstCompletion) {
                profileUpdates['profile.completedAt'] = firestore_1.Timestamp.now();
                profileUpdates['profile.verified'] = false; // Needs admin verification
            }
            profileUpdates.updatedAt = firestore_1.Timestamp.now();
            // Update profile
            await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).update(profileUpdates);
            // Get updated user
            const updatedDoc = await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).get();
            const updatedUser = { id: updatedDoc.id, ...updatedDoc.data() };
            // Convert GeoPoint to plain object for JSON serialization
            if (updatedUser.profile?.location?._latitude !== undefined) {
                console.log('[Profile Update] Converting GeoPoint to {lat, lng}');
                updatedUser.profile.location = {
                    lat: updatedUser.profile.location._latitude,
                    lng: updatedUser.profile.location._longitude,
                };
            }
            console.log('[Profile Update] Returning profile with location:', updatedUser.profile?.location);
            return res.status(200).json({
                success: true,
                data: updatedUser.profile,
                message: isFirstCompletion
                    ? 'Profile completed successfully!'
                    : 'Profile updated successfully',
            });
        }
        catch (error) {
            console.error('Update profile error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to update profile',
            });
        }
    }
    /**
     * Update user location
     * PUT /profile/location
     */
    static async updateLocation(req, res) {
        try {
            const userId = req.userId;
            const { latitude, longitude } = req.body;
            if (!latitude || !longitude) {
                return res.status(400).json({
                    success: false,
                    error: 'Latitude and longitude are required',
                });
            }
            // Validate coordinates
            if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid coordinates',
                });
            }
            // Update location
            await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).update({
                'profile.location': new firestore_1.GeoPoint(latitude, longitude),
                updatedAt: firestore_1.Timestamp.now(),
            });
            return res.status(200).json({
                success: true,
                message: 'Location updated successfully',
            });
        }
        catch (error) {
            console.error('Update location error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to update location',
            });
        }
    }
    /**
     * Upload profile photo
     * POST /profile/photo
     */
    static async uploadPhoto(req, res) {
        try {
            const userId = req.userId;
            const file = req.file;
            if (!file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded',
                });
            }
            // Check file type
            if (!file.mimetype.startsWith('image/')) {
                return res.status(400).json({
                    success: false,
                    error: 'Only image files are allowed',
                });
            }
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                return res.status(400).json({
                    success: false,
                    error: 'File size must be less than 5MB',
                });
            }
            // Get current user photos
            const userDoc = await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).get();
            const userData = userDoc.data();
            const currentPhotos = userData?.profile?.photos || [];
            // Check photo limit
            if (currentPhotos.length >= 6) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum 6 photos allowed',
                });
            }
            // Upload to storage
            const photoUrl = await storage_service_1.StorageService.uploadProfilePhoto(userId, file);
            // Add to user's photos array
            const updatedPhotos = [...currentPhotos, photoUrl];
            await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).update({
                'profile.photos': updatedPhotos,
                updatedAt: firestore_1.Timestamp.now(),
            });
            return res.status(200).json({
                success: true,
                data: { photoUrl, photos: updatedPhotos },
                message: 'Photo uploaded successfully',
            });
        }
        catch (error) {
            console.error('Upload photo error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to upload photo',
            });
        }
    }
    /**
     * Delete profile photo
     * DELETE /profile/photo
     */
    static async deletePhoto(req, res) {
        try {
            const userId = req.userId;
            const { photoUrl } = req.body;
            if (!photoUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'Photo URL is required',
                });
            }
            // Get current user photos
            const userDoc = await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).get();
            const userData = userDoc.data();
            const currentPhotos = userData?.profile?.photos || [];
            // Check if photo exists
            if (!currentPhotos.includes(photoUrl)) {
                return res.status(404).json({
                    success: false,
                    error: 'Photo not found',
                });
            }
            // Delete from storage
            await storage_service_1.StorageService.deleteProfilePhoto(photoUrl);
            // Remove from user's photos array
            const updatedPhotos = currentPhotos.filter((url) => url !== photoUrl);
            await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).update({
                'profile.photos': updatedPhotos,
                updatedAt: firestore_1.Timestamp.now(),
            });
            return res.status(200).json({
                success: true,
                data: { photos: updatedPhotos },
                message: 'Photo deleted successfully',
            });
        }
        catch (error) {
            console.error('Delete photo error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete photo',
            });
        }
    }
    /**
     * Update user interests
     * PUT /profile/interests
     */
    static async updateInterests(req, res) {
        try {
            const userId = req.userId;
            const { interests } = req.body;
            if (!interests || !Array.isArray(interests)) {
                return res.status(400).json({
                    success: false,
                    error: 'Interests must be an array',
                });
            }
            // Limit interests count
            if (interests.length > 20) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum 20 interests allowed',
                });
            }
            // Update interests
            await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).update({
                'profile.interests': interests,
                updatedAt: firestore_1.Timestamp.now(),
            });
            return res.status(200).json({
                success: true,
                data: { interests },
                message: 'Interests updated successfully',
            });
        }
        catch (error) {
            console.error('Update interests error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to update interests',
            });
        }
    }
    /**
     * Fix photo URLs by converting signed URLs to public URLs
     * POST /profile/fix-photos
     */
    static async fixPhotoUrls(req, res) {
        try {
            const userId = req.userId;
            const bucketName = process.env.GCLOUD_STORAGE_BUCKET || 'cosmo-app-photos';
            const apiBaseUrl = process.env.API_BASE_URL || 'http://192.168.1.68:8080';
            // Get current user photos
            const userDoc = await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).get();
            const userData = userDoc.data();
            const currentPhotos = userData?.profile?.photos || [];
            if (currentPhotos.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No photos to fix',
                });
            }
            console.log(`[Fix Photos] Processing ${currentPhotos.length} photos for user ${userId}`);
            const updatedPhotos = [];
            let fixedCount = 0;
            for (const photoUrl of currentPhotos) {
                // Extract filename from any kind of URL (signed, public, or proxied)
                const urlWithoutQuery = photoUrl.split('?')[0];
                let fileName = null;
                if (urlWithoutQuery.includes('/media/image/')) {
                    // Already a proxied URL, keep it
                    updatedPhotos.push(photoUrl);
                    continue;
                }
                else if (urlWithoutQuery.includes(bucketName)) {
                    // Extract from GCS URL
                    fileName = urlWithoutQuery.split(`${bucketName}/`)[1];
                }
                if (fileName) {
                    // Convert to proxied URL format
                    const proxiedUrl = `${apiBaseUrl}/api/v1/media/image/${fileName}`;
                    updatedPhotos.push(proxiedUrl);
                    fixedCount++;
                    console.log(`  ✓ Converted to proxied URL: ${fileName}`);
                }
                else {
                    // Keep original if can't parse
                    console.warn(`  ⚠️  Could not parse: ${photoUrl.substring(0, 100)}`);
                    updatedPhotos.push(photoUrl);
                }
            }
            // Update user's photos in Firestore
            await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).update({
                'profile.photos': updatedPhotos,
                updatedAt: firestore_1.Timestamp.now(),
            });
            return res.status(200).json({
                success: true,
                data: { photos: updatedPhotos, fixedCount },
                message: `Converted ${fixedCount} photo URL(s) to proxied format`,
            });
        }
        catch (error) {
            console.error('Fix photo URLs error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fix photo URLs',
            });
        }
    }
}
exports.ProfileController = ProfileController;
//# sourceMappingURL=profile.controller.js.map