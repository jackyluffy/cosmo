import { Router } from 'express';
import { validateRequest } from '../middleware/validation.middleware';
import { requireAdmin } from '../middleware/auth.middleware';
import Joi from 'joi';
import { db } from '../config/firebase';
import { GeoPoint, Timestamp } from 'firebase-admin/firestore';

const router = Router();

// Admin Controller
const AdminController = {
  getUsers: async (req: any, res: any) => {
    try {
      const { page = 1, limit = 20, status, search } = req.query;

      // TODO: Fetch users from Firestore with pagination
      res.json({
        success: true,
        users: [],
        total: 0,
        page,
        totalPages: 0,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  getUser: async (req: any, res: any) => {
    try {
      const { userId } = req.params;

      // TODO: Fetch user details from Firestore
      res.json({
        success: true,
        user: null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  updateUser: async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      // TODO: Update user in Firestore
      res.json({
        success: true,
        message: 'User updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  suspendUser: async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const { reason, duration } = req.body;

      // TODO: Suspend user in Firestore
      res.json({
        success: true,
        message: 'User suspended successfully',
        suspendedUntil: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  getReports: async (req: any, res: any) => {
    try {
      const { status = 'pending', page = 1, limit = 20 } = req.query;

      // TODO: Fetch reports from Firestore
      res.json({
        success: true,
        reports: [],
        total: 0,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  resolveReport: async (req: any, res: any) => {
    try {
      const { reportId } = req.params;
      const { action, notes } = req.body;

      // TODO: Update report status in Firestore
      res.json({
        success: true,
        message: 'Report resolved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  getAnalytics: async (req: any, res: any) => {
    try {
      const { startDate, endDate, metric } = req.query;

      // TODO: Fetch analytics from Firestore
      res.json({
        success: true,
        analytics: {
          totalUsers: 0,
          newUsers: 0,
          activeUsers: 0,
          totalEvents: 0,
          totalMatches: 0,
          revenue: 0,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  createAnnouncement: async (req: any, res: any) => {
    try {
      const { title, message, targetUsers } = req.body;

      // TODO: Create announcement and send notifications
      res.json({
        success: true,
        message: 'Announcement created successfully',
        recipientCount: 0,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  generateTestUsers: async (req: any, res: any) => {
    try {
      const { targetUserId = 'nA4b1izLMYnGms4hPYJt', count = 30, likersCount = 15 } = req.body;

      console.log(`Generating ${count} test users with ${likersCount} liking ${targetUserId}...`);

      // Fetch target user's location
      const targetUserDoc = await db.collection('users').doc(targetUserId).get();
      if (!targetUserDoc.exists) {
        return res.status(404).json({ success: false, error: 'Target user not found' });
      }

      const targetUserData = targetUserDoc.data();
      const targetLocation = targetUserData?.profile?.location;

      // Use target user's location, or default to SF if not set
      let baseLat, baseLng;
      if (targetLocation && targetLocation.lat && targetLocation.lng) {
        baseLat = targetLocation.lat;
        baseLng = targetLocation.lng;
        console.log(`Using target user location: ${baseLat}, ${baseLng}`);
      } else {
        // Default to San Francisco
        baseLat = 37.7749;
        baseLng = -122.4194;
        console.log(`Target user has no location, using default (SF): ${baseLat}, ${baseLng}`);
      }

      const SAMPLE_NAMES = [
        'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Elijah', 'Sophia', 'James',
        'Isabella', 'William', 'Mia', 'Benjamin', 'Charlotte', 'Lucas', 'Amelia', 'Henry',
        'Harper', 'Theodore', 'Evelyn', 'Jack', 'Abigail', 'Sebastian', 'Emily', 'Owen',
        'Elizabeth', 'Alexander', 'Sofia', 'Michael', 'Avery', 'Daniel'
      ];

      const SAMPLE_INTERESTS = [
        'Hiking', 'Photography', 'Cooking', 'Travel', 'Music', 'Reading', 'Yoga',
        'Gaming', 'Art', 'Coffee', 'Wine', 'Movies', 'Running', 'Cycling', 'Dancing',
        'Fitness', 'Meditation', 'Food', 'Nature', 'Beach', 'Mountains', 'Fashion',
        'Technology', 'Sports', 'Concerts', 'Camping', 'Surfing', 'Skiing'
      ];

      const SAMPLE_BIOS = [
        'Adventure seeker | Coffee enthusiast',
        'Living life one adventure at a time',
        'Passionate about travel and good food',
        'Dog lover | Outdoor enthusiast',
        'Foodie | Always exploring new places',
        'Music and art lover | Beach person',
        'Fitness junkie | Coffee addict',
        'Love to laugh and make memories',
        'Wanderlust | Photography enthusiast',
        'Life is better with good company',
      ];

      const SAMPLE_PHOTO_URLS = [
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400',
        'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400',
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
        'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400',
      ];

      const getRandomElements = <T,>(array: T[], num: number): T[] => {
        return [...array].sort(() => 0.5 - Math.random()).slice(0, num);
      };

      // Generate random location within 10 mile radius
      const generateRandomLocation = (centerLat: number, centerLng: number, radiusMiles: number) => {
        const radiusInDegrees = radiusMiles / 69; // 1 degree ≈ 69 miles
        const randomAngle = Math.random() * 2 * Math.PI;
        const randomRadius = Math.random() * radiusInDegrees;
        const lat = centerLat + randomRadius * Math.cos(randomAngle);
        const lng = centerLng + randomRadius * Math.sin(randomAngle);
        return { lat, lng };
      };

      const batch = db.batch();
      const userIds: string[] = [];

      // Generate test users
      for (let i = 0; i < count; i++) {
        const name = SAMPLE_NAMES[i % SAMPLE_NAMES.length];
        const gender = i % 3 === 0 ? 'male' : i % 3 === 1 ? 'female' : 'non-binary';
        const age = 22 + Math.floor(Math.random() * 16);

        const photos = getRandomElements(SAMPLE_PHOTO_URLS, 3);
        const interests = getRandomElements(SAMPLE_INTERESTS, 3 + Math.floor(Math.random() * 5));

        // Generate location within 10 miles of target user
        const { lat, lng } = generateRandomLocation(baseLat, baseLng, 10);

        const userId = `test-user-${Date.now()}-${i}`;
        const userRef = db.collection('users').doc(userId);

        batch.set(userRef, {
          userId,
          phoneNumber: `+1555${String(i + 1000).slice(-7)}`,
          profile: {
            name,
            age,
            gender,
            bio: SAMPLE_BIOS[i % SAMPLE_BIOS.length],
            photos,
            interests,
            lookingFor: 'everyone',
            ageRange: { min: 21, max: 40 },
            maxDistance: 50,
            location: { lat, lng },
          },
          subscription: {
            status: 'trial',
            plan: 'free',
          },
          onboarding: {
            completed: true,
            currentStep: 'completed',
          },
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        userIds.push(userId);
      }

      await batch.commit();
      console.log(`✓ Created ${count} test users`);

      // Create swipes
      const likingUsers = getRandomElements(userIds, likersCount);
      const swipeBatch = db.batch();

      for (const likerId of likingUsers) {
        const swipeId = `${likerId}_${targetUserId}`;
        const swipeRef = db.collection('swipes').doc(swipeId);

        swipeBatch.set(swipeRef, {
          swipeId,
          userId: likerId,
          targetUserId,
          direction: 'right',
          createdAt: Timestamp.now(),
        });
      }

      await swipeBatch.commit();
      console.log(`✓ Created ${likersCount} likes for ${targetUserId}`);

      res.json({
        success: true,
        message: `Created ${count} test users with ${likersCount} likes`,
        userIds,
        likingUsers,
      });
    } catch (error: any) {
      console.error('Error generating test users:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  updateTestUserProfiles: async (req: any, res: any) => {
    try {
      const {
        // Location options
        centerLat = 33.8722,
        centerLng = -117.8703,  // Placentia, CA (W longitude is negative)
        radiusMiles = 10,
        updateLocation = true,

        // Gender options
        gender,  // 'male', 'female', 'non-binary', or null to skip

        // Age options
        minAge,  // e.g., 25
        maxAge,  // e.g., 35

        // Interests options
        interests,  // Array of interests to set, or null to skip
      } = req.body;

      console.log('Updating test user profiles with options:', {
        updateLocation,
        gender,
        ageRange: minAge && maxAge ? `${minAge}-${maxAge}` : 'unchanged',
        interestsCount: interests ? interests.length : 'unchanged',
      });

      // Generate random location within specified radius
      const generateRandomLocation = (lat: number, lng: number, radius: number) => {
        const radiusInDegrees = radius / 69;
        const randomAngle = Math.random() * 2 * Math.PI;
        const randomRadius = Math.random() * radiusInDegrees;
        return {
          lat: lat + randomRadius * Math.cos(randomAngle),
          lng: lng + randomRadius * Math.sin(randomAngle),
        };
      };

      // Generate random age within range
      const generateRandomAge = (min: number, max: number) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      };

      // Query all test users
      const usersSnapshot = await db.collection('users')
        .where('userId', '>=', 'test-user-')
        .where('userId', '<', 'test-user-~')
        .get();

      if (usersSnapshot.empty) {
        return res.json({ success: true, message: 'No test users found', updatedCount: 0 });
      }

      const batch = db.batch();
      let updateCount = 0;
      const updates: any[] = [];

      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        const updateData: any = {
          updatedAt: Timestamp.now(),
        };

        const changes: any = {};

        // Update location if requested
        if (updateLocation) {
          const newLocation = generateRandomLocation(centerLat, centerLng, radiusMiles);
          updateData['profile.location'] = newLocation;
          changes.location = { old: userData.profile?.location, new: newLocation };
        }

        // Update gender if provided
        if (gender) {
          updateData['profile.gender'] = gender;
          changes.gender = { old: userData.profile?.gender, new: gender };
        }

        // Update age if range provided
        if (minAge !== undefined && maxAge !== undefined) {
          const newAge = generateRandomAge(minAge, maxAge);
          updateData['profile.age'] = newAge;
          changes.age = { old: userData.profile?.age, new: newAge };
        }

        // Update interests if provided
        if (interests && Array.isArray(interests) && interests.length > 0) {
          updateData['profile.interests'] = interests;
          changes.interests = { old: userData.profile?.interests, new: interests };
        }

        batch.update(doc.ref, updateData);

        updates.push({
          userId: userData.userId,
          changes,
        });

        updateCount++;
      }

      await batch.commit();

      console.log(`✓ Updated ${updateCount} test users`);

      res.json({
        success: true,
        message: `Updated ${updateCount} test users' profiles`,
        updatedCount: updateCount,
        options: {
          location: updateLocation ? { lat: centerLat, lng: centerLng, radiusMiles } : 'unchanged',
          gender: gender || 'unchanged',
          ageRange: minAge && maxAge ? { min: minAge, max: maxAge } : 'unchanged',
          interests: interests ? `${interests.length} interests` : 'unchanged',
        },
        updates: updates.slice(0, 5), // Return first 5 for verification
      });
    } catch (error: any) {
      console.error('Error updating test user profiles:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  seedUsers: async (req: any, res: any) => {
    try {
      // DEV ONLY: Seed 20 test users
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({
          success: false,
          error: 'Seeding only available in development mode',
        });
      }

      const CENTER_LAT = 33.8722;
      const CENTER_LNG = -117.8703;
      const MAX_RADIUS_MILES = 20;
      const MILES_TO_DEGREES = 1 / 69;

      const generateRandomLocation = (): GeoPoint => {
        const radiusInDegrees = MAX_RADIUS_MILES * MILES_TO_DEGREES;
        const randomAngle = Math.random() * 2 * Math.PI;
        const randomRadius = Math.random() * radiusInDegrees;
        const lat = CENTER_LAT + randomRadius * Math.cos(randomAngle);
        const lng = CENTER_LNG + randomRadius * Math.sin(randomAngle);
        return new GeoPoint(lat, lng);
      };

      const firstNames = [
        'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Avery',
        'Quinn', 'Reese', 'Blake', 'Drew', 'Sage', 'River', 'Phoenix', 'Skylar',
        'Rowan', 'Finley', 'Emerson', 'Hayden'
      ];

      const bios = [
        'Love exploring new coffee shops and hiking trails',
        'Foodie, adventurer, and tennis enthusiast',
        'Always up for trying new restaurants or catching live music',
        'Weekend warrior who loves brunch and beach days',
        'Fitness junkie and craft beer connoisseur',
        'Bookworm by day, social butterfly by night',
        'Passionate about cooking and outdoor adventures',
        'Tennis player looking for doubles partners and fun people',
        'Brunch lover who enjoys good company and great food',
        'Hiking enthusiast who also loves a good bar crawl',
        'Yoga instructor who loves trying new restaurants',
        'Software engineer who needs to get out more',
        'Dog lover, runner, and amateur photographer',
        'Music festival addict and taco enthusiast',
        'Rock climber who also enjoys fine dining',
        'Beach volleyball player and sunset chaser',
        'Wine lover who enjoys hiking and live music',
        'Foodie explorer always seeking the next best meal',
        'Outdoor enthusiast who loves group adventures',
        'Social connector who brings people together'
      ];

      const interests = [
        'tennis', 'hiking', 'coffee', 'brunch', 'craft beer', 'wine tasting',
        'live music', 'yoga', 'running', 'beach', 'cooking', 'photography',
        'travel', 'fitness', 'food', 'reading', 'movies', 'art', 'dancing',
        'volleyball', 'cycling', 'kayaking', 'rock climbing', 'meditation'
      ];

      const photos = [
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400',
        'https://images.unsplash.com/photo-1504593811423-6dd665756598?w=400',
        'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=400',
      ];

      const batch = db.batch();
      const userIds: string[] = [];

      for (let i = 0; i < 20; i++) {
        const userRef = db.collection('users').doc();
        userIds.push(userRef.id);

        const location = generateRandomLocation();
        const age = 21 + Math.floor(Math.random() * 24);
        const gender = i % 2 === 0 ? 'male' : 'female';
        const name = firstNames[i];

        const numInterests = 3 + Math.floor(Math.random() * 4);
        const userInterests = [...interests]
          .sort(() => Math.random() - 0.5)
          .slice(0, numInterests);

        const userPhotos = [...photos]
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);

        const userData = {
          phone: `+1555000${String(i).padStart(4, '0')}`,
          isActive: true,
          profile: {
            name,
            age,
            gender,
            bio: bios[i],
            photos: userPhotos,
            interests: userInterests,
            lookingFor: ['male', 'female'],
            location,
            radius: 25,
            verified: true,
            traits: {
              extroversion: Math.floor(Math.random() * 100),
              openness: Math.floor(Math.random() * 100),
              agreeableness: Math.floor(Math.random() * 100),
              conscientiousness: Math.floor(Math.random() * 100),
            },
          },
          subscription: {
            status: 'active',
            tier: 'premium',
            trialEventUsed: false,
            expiresAt: Timestamp.fromDate(new Date('2026-12-31')),
          },
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        batch.set(userRef, userData);
      }

      await batch.commit();

      res.json({
        success: true,
        message: 'Successfully seeded 20 test users',
        userIds,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
};

// Validation schemas
const getUsersSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  status: Joi.string().valid('active', 'suspended', 'deleted'),
  search: Joi.string(),
});

const suspendUserSchema = Joi.object({
  reason: Joi.string().required(),
  duration: Joi.number().min(1).max(365).required(), // days
});

const resolveReportSchema = Joi.object({
  action: Joi.string().valid('dismiss', 'warn', 'suspend', 'ban').required(),
  notes: Joi.string(),
});

const analyticsSchema = Joi.object({
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  metric: Joi.string().valid('users', 'events', 'matches', 'revenue'),
});

const announcementSchema = Joi.object({
  title: Joi.string().required(),
  message: Joi.string().required(),
  targetUsers: Joi.string().valid('all', 'active', 'premium'),
});

// Test users generation (no auth for ease of testing)
router.post('/generate-test-users', AdminController.generateTestUsers);
router.post('/update-test-user-profiles', AdminController.updateTestUserProfiles);

// Apply admin middleware to all routes below
router.use(requireAdmin);

// Routes
router.get(
  '/users',
  validateRequest(getUsersSchema, 'query'),
  AdminController.getUsers
);

router.get('/users/:userId', AdminController.getUser);

router.put('/users/:userId', AdminController.updateUser);

router.post(
  '/users/:userId/suspend',
  validateRequest(suspendUserSchema),
  AdminController.suspendUser
);

router.get('/reports', AdminController.getReports);

router.put(
  '/reports/:reportId/resolve',
  validateRequest(resolveReportSchema),
  AdminController.resolveReport
);

router.get(
  '/analytics',
  validateRequest(analyticsSchema, 'query'),
  AdminController.getAnalytics
);

router.post(
  '/announcements',
  validateRequest(announcementSchema),
  AdminController.createAnnouncement
);

export const adminRoutes = router;
export { AdminController };
