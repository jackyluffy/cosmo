import { Request, Response } from 'express';
import { db, Collections } from '../config/firebase';
import { ApiResponse, UpdateProfileRequest } from '../types';
import { Timestamp, GeoPoint } from 'firebase-admin/firestore';
import { StorageService } from '../services/storage.service';

export class ProfileController {
  /**
   * Get current user profile
   * GET /profile/me
   */
  static async getMyProfile(req: Request, res: Response) {
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
      } as ApiResponse);
    } catch (error: any) {
      console.error('Get profile error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch profile',
      } as ApiResponse);
    }
  }

  /**
   * Update user profile
   * PUT /profile
   */
  static async updateProfile(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const updates: UpdateProfileRequest = req.body;

      console.log('[Profile Update] Received updates:', JSON.stringify(updates, null, 2));

      // Validate age if provided
      if (updates.age !== undefined) {
        if (updates.age < 18 || updates.age > 100) {
          return res.status(400).json({
            success: false,
            error: 'Age must be between 18 and 100',
          } as ApiResponse);
        }
      }

      // Prepare profile updates
      const profileUpdates: any = {};

      if (updates.name) profileUpdates['profile.name'] = updates.name;
      if (updates.age) profileUpdates['profile.age'] = updates.age;
      if (updates.gender) profileUpdates['profile.gender'] = updates.gender;
      if (updates.genderPreference) profileUpdates['profile.genderPreference'] = updates.genderPreference;
      if (updates.bio) profileUpdates['profile.bio'] = updates.bio;
      if (updates.interests) profileUpdates['profile.interests'] = updates.interests;
      if (updates.traits) profileUpdates['profile.traits'] = updates.traits;
      if (updates.radius) profileUpdates['profile.radius'] = updates.radius;
      if (updates.photos) profileUpdates['profile.photos'] = updates.photos;
      if (updates.location) {
        console.log('[Profile Update] Creating GeoPoint from:', updates.location);
        profileUpdates['profile.location'] = new GeoPoint(updates.location.lat, updates.location.lng);
        console.log('[Profile Update] GeoPoint created:', profileUpdates['profile.location']);
      }

      // Check if profile is being completed for the first time
      const userDoc = await db.collection(Collections.USERS).doc(userId).get();
      const userData = userDoc.data();
      const isFirstCompletion = !userData?.profile?.completedAt;

      if (isFirstCompletion) {
        profileUpdates['profile.completedAt'] = Timestamp.now();
        profileUpdates['profile.verified'] = false; // Needs admin verification
      }

      profileUpdates.updatedAt = Timestamp.now();

      // Update profile
      await db.collection(Collections.USERS).doc(userId).update(profileUpdates);

      // Get updated user
      const updatedDoc = await db.collection(Collections.USERS).doc(userId).get();
      const updatedUser = { id: updatedDoc.id, ...updatedDoc.data() } as any;

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
      } as ApiResponse);
    } catch (error: any) {
      console.error('Update profile error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update profile',
      } as ApiResponse);
    }
  }

  /**
   * Update user location
   * PUT /profile/location
   */
  static async updateLocation(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const { latitude, longitude } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Latitude and longitude are required',
        } as ApiResponse);
      }

      // Validate coordinates
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates',
        } as ApiResponse);
      }

      // Update location
      await db.collection(Collections.USERS).doc(userId).update({
        'profile.location': new GeoPoint(latitude, longitude),
        updatedAt: Timestamp.now(),
      });

      return res.status(200).json({
        success: true,
        message: 'Location updated successfully',
      } as ApiResponse);
    } catch (error: any) {
      console.error('Update location error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update location',
      } as ApiResponse);
    }
  }

  /**
   * Upload profile photo
   * POST /profile/photo
   */
  static async uploadPhoto(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        } as ApiResponse);
      }

      // Check file type
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          error: 'Only image files are allowed',
        } as ApiResponse);
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: 'File size must be less than 5MB',
        } as ApiResponse);
      }

      // Get current user photos
      const userDoc = await db.collection(Collections.USERS).doc(userId).get();
      const userData = userDoc.data();
      const currentPhotos = userData?.profile?.photos || [];

      // Check photo limit
      if (currentPhotos.length >= 6) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 6 photos allowed',
        } as ApiResponse);
      }

      // Upload to storage
      const photoUrl = await StorageService.uploadProfilePhoto(userId, file);

      // Add to user's photos array
      const updatedPhotos = [...currentPhotos, photoUrl];
      await db.collection(Collections.USERS).doc(userId).update({
        'profile.photos': updatedPhotos,
        updatedAt: Timestamp.now(),
      });

      return res.status(200).json({
        success: true,
        data: { photoUrl, photos: updatedPhotos },
        message: 'Photo uploaded successfully',
      } as ApiResponse);
    } catch (error: any) {
      console.error('Upload photo error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload photo',
      } as ApiResponse);
    }
  }

  /**
   * Delete profile photo
   * DELETE /profile/photo
   */
  static async deletePhoto(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const { photoUrl } = req.body;

      if (!photoUrl) {
        return res.status(400).json({
          success: false,
          error: 'Photo URL is required',
        } as ApiResponse);
      }

      // Get current user photos
      const userDoc = await db.collection(Collections.USERS).doc(userId).get();
      const userData = userDoc.data();
      const currentPhotos = userData?.profile?.photos || [];

      // Check if photo exists
      if (!currentPhotos.includes(photoUrl)) {
        return res.status(404).json({
          success: false,
          error: 'Photo not found',
        } as ApiResponse);
      }

      // Delete from storage
      await StorageService.deleteProfilePhoto(photoUrl);

      // Remove from user's photos array
      const updatedPhotos = currentPhotos.filter((url: string) => url !== photoUrl);
      await db.collection(Collections.USERS).doc(userId).update({
        'profile.photos': updatedPhotos,
        updatedAt: Timestamp.now(),
      });

      return res.status(200).json({
        success: true,
        data: { photos: updatedPhotos },
        message: 'Photo deleted successfully',
      } as ApiResponse);
    } catch (error: any) {
      console.error('Delete photo error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete photo',
      } as ApiResponse);
    }
  }

  /**
   * Update user interests
   * PUT /profile/interests
   */
  static async updateInterests(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const { interests } = req.body;

      if (!interests || !Array.isArray(interests)) {
        return res.status(400).json({
          success: false,
          error: 'Interests must be an array',
        } as ApiResponse);
      }

      // Limit interests count
      if (interests.length > 20) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 20 interests allowed',
        } as ApiResponse);
      }

      // Update interests
      await db.collection(Collections.USERS).doc(userId).update({
        'profile.interests': interests,
        updatedAt: Timestamp.now(),
      });

      return res.status(200).json({
        success: true,
        data: { interests },
        message: 'Interests updated successfully',
      } as ApiResponse);
    } catch (error: any) {
      console.error('Update interests error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update interests',
      } as ApiResponse);
    }
  }

  /**
   * Fix photo URLs by converting signed URLs to public URLs
   * POST /profile/fix-photos
   */
  static async fixPhotoUrls(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const bucketName = process.env.GCLOUD_STORAGE_BUCKET || 'cosmo-app-photos';
      const apiBaseUrl = process.env.API_BASE_URL || 'http://192.168.1.68:8080';

      // Get current user photos
      const userDoc = await db.collection(Collections.USERS).doc(userId).get();
      const userData = userDoc.data();
      const currentPhotos = userData?.profile?.photos || [];

      if (currentPhotos.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No photos to fix',
        } as ApiResponse);
      }

      console.log(`[Fix Photos] Processing ${currentPhotos.length} photos for user ${userId}`);
      const updatedPhotos: string[] = [];
      let fixedCount = 0;

      for (const photoUrl of currentPhotos) {
        // Extract filename from any kind of URL (signed, public, or proxied)
        const urlWithoutQuery = photoUrl.split('?')[0];
        let fileName: string | null = null;

        if (urlWithoutQuery.includes('/media/image/')) {
          // Already a proxied URL, keep it
          updatedPhotos.push(photoUrl);
          continue;
        } else if (urlWithoutQuery.includes(bucketName)) {
          // Extract from GCS URL
          fileName = urlWithoutQuery.split(`${bucketName}/`)[1];
        }

        if (fileName) {
          // Convert to proxied URL format
          const proxiedUrl = `${apiBaseUrl}/api/v1/media/image/${fileName}`;
          updatedPhotos.push(proxiedUrl);
          fixedCount++;
          console.log(`  ✓ Converted to proxied URL: ${fileName}`);
        } else {
          // Keep original if can't parse
          console.warn(`  ⚠️  Could not parse: ${photoUrl.substring(0, 100)}`);
          updatedPhotos.push(photoUrl);
        }
      }

      // Update user's photos in Firestore
      await db.collection(Collections.USERS).doc(userId).update({
        'profile.photos': updatedPhotos,
        updatedAt: Timestamp.now(),
      });

      return res.status(200).json({
        success: true,
        data: { photos: updatedPhotos, fixedCount },
        message: `Converted ${fixedCount} photo URL(s) to proxied format`,
      } as ApiResponse);
    } catch (error: any) {
      console.error('Fix photo URLs error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fix photo URLs',
      } as ApiResponse);
    }
  }
}