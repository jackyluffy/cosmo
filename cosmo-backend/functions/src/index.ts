import * as functions from 'firebase-functions';
import * as express from 'express';
import * as cors from 'cors';
import multer from 'multer';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { ProfileController } from './controllers/profile.controller';
import { EventController } from './controllers/event.controller';

// Middleware
import { authenticate, requireCompleteProfile, requireActiveSubscription } from './middleware/auth.middleware';

// Services
import { MatchingService } from './services/matching.service';

// Initialize Express app
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// Authentication Routes
// ============================================
app.post('/auth/otp/request', AuthController.requestOTP);
app.post('/auth/otp/verify', AuthController.verifyOTP);
app.post('/auth/validate', AuthController.validateToken);
app.post('/auth/logout', authenticate, AuthController.logout);

// ============================================
// Profile Routes (Protected)
// ============================================
app.get('/profile/me', authenticate, ProfileController.getMyProfile);
app.put('/profile', authenticate, ProfileController.updateProfile);
app.put('/profile/location', authenticate, ProfileController.updateLocation);
app.put('/profile/interests', authenticate, ProfileController.updateInterests);
app.post('/profile/photo', authenticate, upload.single('photo'), ProfileController.uploadPhoto);
app.delete('/profile/photo', authenticate, ProfileController.deletePhoto);

// ============================================
// Event Routes
// ============================================
app.get('/events', authenticate, EventController.getEvents);
app.get('/events/:id', authenticate, EventController.getEvent);
app.post('/events', authenticate, requireCompleteProfile, EventController.createEvent);
app.post('/events/:id/join', authenticate, requireCompleteProfile, requireActiveSubscription, EventController.joinEvent);
app.delete('/events/:id/leave', authenticate, EventController.leaveEvent);

// ============================================
// Error handling
// ============================================
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Export Express app as Cloud Function
export const api = functions.https.onRequest(app);

// ============================================
// Scheduled Functions
// ============================================

/**
 * Run matching algorithm daily at 2 AM
 */
export const runDailyMatching = functions.pubsub
  .schedule('0 2 * * *')
  .timeZone('America/Los_Angeles')
  .onRun(async (context) => {
    console.log('Running daily matching algorithm');

    try {
      // Get events happening in the next 3 days
      const { db, Collections } = require('./config/firebase');
      const { Timestamp } = require('firebase-admin/firestore');

      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const eventsSnapshot = await db.collection(Collections.EVENTS)
        .where('status', '==', 'published')
        .where('date', '>', Timestamp.now())
        .where('date', '<', Timestamp.fromDate(threeDaysFromNow))
        .get();

      console.log(`Found ${eventsSnapshot.size} upcoming events`);

      // Run matching for each event
      for (const eventDoc of eventsSnapshot.docs) {
        await MatchingService.runMatchingForEvent(eventDoc.id);
      }

      console.log('Daily matching completed');
    } catch (error) {
      console.error('Daily matching error:', error);
    }
  });

/**
 * Clean up expired OTP codes daily
 */
export const cleanupOTPCodes = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('America/Los_Angeles')
  .onRun(async (context) => {
    console.log('Cleaning up expired OTP codes');

    try {
      const { db, Collections } = require('./config/firebase');
      const { Timestamp } = require('firebase-admin/firestore');

      // Delete OTP codes older than 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const otpSnapshot = await db.collection(Collections.OTP_CODES)
        .where('createdAt', '<', Timestamp.fromDate(yesterday))
        .get();

      const batch = db.batch();
      otpSnapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Deleted ${otpSnapshot.size} expired OTP codes`);
    } catch (error) {
      console.error('OTP cleanup error:', error);
    }
  });

// ============================================
// Firestore Triggers
// ============================================

/**
 * Send notification when user is matched to a group
 */
export const onGroupCreated = functions.firestore
  .document('groups/{groupId}')
  .onCreate(async (snap, context) => {
    const groupData = snap.data();
    const groupId = context.params.groupId;

    console.log(`New group created: ${groupId}`);

    // TODO: Send push notifications to group members
    // TODO: Create chat room for the group
    // TODO: Send welcome email/SMS
  });

/**
 * Handle user deletion
 */
export const onUserDeleted = functions.firestore
  .document('users/{userId}')
  .onDelete(async (snap, context) => {
    const userId = context.params.userId;
    const { StorageService } = require('./services/storage.service');

    console.log(`User deleted: ${userId}`);

    try {
      // Delete user's photos from storage
      await StorageService.deleteAllUserPhotos(userId);

      // TODO: Remove user from all groups
      // TODO: Cancel any active subscriptions
      // TODO: Delete user's messages
    } catch (error) {
      console.error('User deletion cleanup error:', error);
    }
  });