import { Router } from 'express';
import { MatchingService } from '../services/matching.service';
import { logger } from '../utils/logger';
import { db, Collections } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

const router = Router();

// Middleware to verify cron secret
const verifyCronSecret = (req: any, res: any, next: any) => {
  const cronSecret = req.headers['x-cron-secret'];

  if (cronSecret !== process.env.CRON_SECRET) {
    logger.warn('Unauthorized cron job attempt');
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
};

// Apply middleware to all cron routes
router.use(verifyCronSecret);

/**
 * Run daily matching algorithm
 * Should be called by Cloud Scheduler at 2 AM PST
 */
router.post('/daily-matching', async (req, res) => {
  logger.info('Starting daily matching algorithm');

  try {
    // Get events happening in the next 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const eventsSnapshot = await db.collection(Collections.EVENTS)
      .where('status', '==', 'published')
      .where('starts_at', '>', Timestamp.now())
      .where('starts_at', '<', Timestamp.fromDate(threeDaysFromNow))
      .get();

    logger.info(`Found ${eventsSnapshot.size} upcoming events`);

    // Run matching for each event
    const results = [];
    for (const eventDoc of eventsSnapshot.docs) {
      try {
        await MatchingService.runMatchingForEvent(eventDoc.id);
        results.push({ eventId: eventDoc.id, status: 'success' });
      } catch (error) {
        logger.error(`Matching failed for event ${eventDoc.id}:`, error);
        results.push({ eventId: eventDoc.id, status: 'error', error: error.message });
      }
    }

    logger.info('Daily matching completed');

    res.json({
      success: true,
      eventsProcessed: eventsSnapshot.size,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Daily matching error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Clean up expired OTP codes
 * Should be called daily at midnight
 */
router.post('/cleanup-otp', async (req, res) => {
  logger.info('Starting OTP cleanup');

  try {
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

    logger.info(`Deleted ${otpSnapshot.size} expired OTP codes`);

    res.json({
      success: true,
      deletedCount: otpSnapshot.size,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('OTP cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Send daily engagement notifications
 */
router.post('/daily-notifications', async (req, res) => {
  logger.info('Starting daily notifications');

  try {
    // Get inactive users (no activity in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const inactiveUsersSnapshot = await db.collection(Collections.USERS)
      .where('lastActive', '<', Timestamp.fromDate(sevenDaysAgo))
      .where('notifications.engagement', '==', true)
      .limit(100) // Process in batches
      .get();

    logger.info(`Found ${inactiveUsersSnapshot.size} inactive users`);

    // TODO: Send engagement notifications
    // This would integrate with your notification service

    res.json({
      success: true,
      usersNotified: inactiveUsersSnapshot.size,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Daily notifications error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update subscription statuses
 * Check for expired subscriptions daily
 */
router.post('/update-subscriptions', async (req, res) => {
  logger.info('Updating subscription statuses');

  try {
    const now = Timestamp.now();

    // Find expired subscriptions
    const expiredSubscriptionsSnapshot = await db.collection(Collections.SUBSCRIPTIONS)
      .where('status', '==', 'active')
      .where('expiresAt', '<', now)
      .get();

    logger.info(`Found ${expiredSubscriptionsSnapshot.size} expired subscriptions`);

    const batch = db.batch();
    expiredSubscriptionsSnapshot.docs.forEach((doc: any) => {
      batch.update(doc.ref, {
        status: 'expired',
        updatedAt: now,
      });
    });

    await batch.commit();

    res.json({
      success: true,
      expiredCount: expiredSubscriptionsSnapshot.size,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Subscription update error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Generate analytics report
 * Run weekly on Sundays
 */
router.post('/weekly-analytics', async (req, res) => {
  logger.info('Generating weekly analytics');

  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Collect various metrics
    const [
      newUsersSnapshot,
      eventsSnapshot,
      matchesSnapshot,
    ] = await Promise.all([
      db.collection(Collections.USERS)
        .where('createdAt', '>', Timestamp.fromDate(oneWeekAgo))
        .get(),
      db.collection(Collections.EVENTS)
        .where('createdAt', '>', Timestamp.fromDate(oneWeekAgo))
        .get(),
      db.collection(Collections.MATCHES)
        .where('createdAt', '>', Timestamp.fromDate(oneWeekAgo))
        .get(),
    ]);

    const analytics = {
      newUsers: newUsersSnapshot.size,
      newEvents: eventsSnapshot.size,
      newMatches: matchesSnapshot.size,
      weekStarting: oneWeekAgo.toISOString(),
      weekEnding: new Date().toISOString(),
    };

    // Store analytics in database
    await db.collection(Collections.ANALYTICS).add({
      type: 'weekly_report',
      data: analytics,
      createdAt: Timestamp.now(),
    });

    logger.info('Weekly analytics generated:', analytics);

    res.json({
      success: true,
      analytics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Analytics generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export const cronRoutes = router;