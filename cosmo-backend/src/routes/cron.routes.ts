import { Router } from 'express';
import { MatchingService } from '../services/matching.service';
import { EventReminderService } from '../services/event-reminder.service';
import { EventOrchestrationService } from '../services/event-orchestration.service';
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

/**
 * Auto-organize pending events by consuming queued pair matches.
 * Intended to be triggered by Cloud Scheduler (e.g., every 15 minutes).
 */
router.post('/auto-organize-events', async (req, res) => {
  logger.info('Starting auto event orchestration');
  try {
    const createdByType = await EventOrchestrationService.processAllQueues();
    logger.info('Auto event orchestration completed', createdByType);

    res.json({
      success: true,
      createdEvents: createdByType,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Auto event orchestration error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Send 48-hour event reminders to joined participants.
 */
router.post('/event-reminders', async (req, res) => {
  logger.info('Running event reminder scheduler');
  try {
    const result = await EventReminderService.sendUpcomingEventReminders();
    res.json({
      success: true,
      processed: result.processed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Event reminder error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Clean up users' pendingEvents arrays by removing deleted event references.
 * This is useful after deleting events to make users eligible for new events.
 */
router.post('/cleanup-user-pending-events', async (req, res) => {
  logger.info('Starting user pendingEvents cleanup');
  try {
    // Get all events to build a set of valid event IDs
    const eventsSnap = await db.collection(Collections.EVENTS).get();
    const validEventIds = new Set(eventsSnap.docs.map(doc => doc.id));

    logger.info(`Found ${validEventIds.size} valid events`);

    // Get all users
    const usersSnap = await db.collection(Collections.USERS).get();

    let updatedCount = 0;
    let alreadyCleanCount = 0;
    let totalPendingEventsRemoved = 0;
    const batch = db.batch();
    let batchCount = 0;
    const MAX_BATCH_SIZE = 500;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const pendingEvents = userData.pendingEvents || [];

      if (pendingEvents.length === 0) {
        alreadyCleanCount++;
        continue;
      }

      // Filter out deleted events
      const cleanedPendingEvents = pendingEvents.filter((assignment: any) =>
        validEventIds.has(assignment.eventId)
      );

      if (cleanedPendingEvents.length !== pendingEvents.length) {
        const removedCount = pendingEvents.length - cleanedPendingEvents.length;
        totalPendingEventsRemoved += removedCount;

        batch.update(userDoc.ref, {
          pendingEvents: cleanedPendingEvents,
          pendingEventCount: cleanedPendingEvents.length,
        });

        updatedCount++;
        batchCount++;

        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          logger.info(`Committed batch of ${batchCount} user updates`);
          batchCount = 0;
        }
      } else {
        alreadyCleanCount++;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      logger.info(`Committed final batch of ${batchCount} user updates`);
    }

    logger.info('User cleanup completed', {
      totalUsers: usersSnap.size,
      updated: updatedCount,
      alreadyClean: alreadyCleanCount,
      totalPendingEventsRemoved,
    });

    res.json({
      success: true,
      totalUsers: usersSnap.size,
      updated: updatedCount,
      alreadyClean: alreadyCleanCount,
      totalPendingEventsRemoved,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('User pendingEvents cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Debug event orchestration logic to see why events aren't being created
 */
router.post('/debug-orchestration', async (req, res) => {
  logger.info('Debugging event orchestration');
  try {
    const eventType = 'dog_walking';
    const ACTIVE_ASSIGNMENT_STATUSES = new Set(['pending_join', 'joined', 'confirmed']);

    const debugLog: any[] = [];

    // Step 1: Get queued pairs
    debugLog.push({ step: 1, message: 'Fetching queued pairs' });
    const queuedSnap = await db.collection(Collections.PAIR_MATCHES)
      .where('queueStatus', '==', 'queued')
      .where('queueEventType', '==', eventType)
      .get();

    debugLog.push({ step: 1, result: `Found ${queuedSnap.size} queued pairs` });

    const pairs = queuedSnap.docs.map(doc => ({
      id: doc.id,
      userIds: doc.data().userIds,
      queueStatus: doc.data().queueStatus,
      queueEventType: doc.data().queueEventType,
      pendingEventId: doc.data().pendingEventId,
    }));

    debugLog.push({ step: 1, pairs });

    // Step 2: Filter by pendingEventId
    const eligiblePairs = pairs.filter(p => !p.pendingEventId);
    debugLog.push({ step: 2, message: 'After filtering pendingEventId', count: eligiblePairs.length });

    // Step 3: Check user eligibility
    debugLog.push({ step: 3, message: 'Checking user eligibility' });
    const filteredPairs: any[] = [];

    for (const pair of eligiblePairs) {
      const userChecks: any[] = [];

      for (const userId of pair.userIds) {
        const userSnap = await db.collection(Collections.USERS).doc(userId).get();
        if (!userSnap.exists) {
          userChecks.push({ userId, exists: false, hasActive: false });
          continue;
        }

        const userData = userSnap.data();
        const assignments = userData?.pendingEvents || [];
        const hasActive = assignments.some(
          (assignment: any) =>
            assignment.eventType === eventType &&
            ACTIVE_ASSIGNMENT_STATUSES.has(assignment.status)
        );

        userChecks.push({
          userId,
          exists: true,
          hasActive,
          pendingEvents: assignments,
        });
      }

      const hasConflict = userChecks.some(check => check.hasActive);
      debugLog.push({
        pairId: pair.id,
        users: userChecks,
        eligible: !hasConflict,
      });

      if (!hasConflict) {
        filteredPairs.push(pair);
      }
    }

    debugLog.push({
      step: 4,
      message: 'Final result',
      eligiblePairsCount: filteredPairs.length,
      requiredPairs: 2,
      canCreateEvents: filteredPairs.length >= 2,
    });

    res.json({
      success: true,
      debugLog,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Debug orchestration error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Delete specific events and clean up user references
 */
router.post('/delete-events', async (req, res) => {
  logger.info('Deleting specific events');
  try {
    const eventIds: string[] = req.body.eventIds || [];

    if (eventIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No eventIds provided',
      });
    }

    const results: any[] = [];

    for (const eventId of eventIds) {
      try {
        await db.collection(Collections.EVENTS).doc(eventId).delete();
        results.push({ eventId, deleted: true });
        logger.info(`Deleted event ${eventId}`);
      } catch (error: any) {
        results.push({ eventId, deleted: false, error: error.message });
        logger.error(`Failed to delete event ${eventId}:`, error);
      }
    }

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Delete events error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Check specific events
 */
router.post('/check-events', async (req, res) => {
  logger.info('Checking specific events');
  try {
    const eventIds = req.body.eventIds || [
      'SaHXC4ZLTEeTMi0yyT39',
      'nsHxXMTEbOUle5cjrqUy',
      'xvt2f1W9jxQap7e3grx9',
    ];

    const results: any[] = [];

    for (const eventId of eventIds) {
      const eventSnap = await db.collection(Collections.EVENTS).doc(eventId).get();

      if (eventSnap.exists) {
        const eventData = eventSnap.data();
        results.push({
          eventId,
          exists: true,
          status: eventData?.status,
          eventType: eventData?.eventType,
          participantCount: eventData?.participantUserIds?.length || 0,
          pendingPairMatchIds: eventData?.pendingPairMatchIds || [],
        });
      } else {
        results.push({
          eventId,
          exists: false,
        });
      }
    }

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Check events error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Delete ALL events and reset all user and pair_match fields.
 * This is a complete reset to test new event creation logic.
 */
router.post('/cleanup-all-events', async (req, res) => {
  logger.info('Starting complete cleanup of all events');
  try {
    // 1. Delete all events
    logger.info('Step 1: Deleting all events from EVENTS collection...');
    const eventsSnapshot = await db.collection(Collections.EVENTS).get();
    const eventCount = eventsSnapshot.size;

    const eventBatch = db.batch();
    let eventBatchCount = 0;
    const MAX_BATCH_SIZE = 500;

    for (const doc of eventsSnapshot.docs) {
      eventBatch.delete(doc.ref);
      eventBatchCount++;

      if (eventBatchCount >= MAX_BATCH_SIZE) {
        await eventBatch.commit();
        logger.info(`Committed batch of ${eventBatchCount} event deletes`);
        eventBatchCount = 0;
      }
    }

    if (eventBatchCount > 0) {
      await eventBatch.commit();
      logger.info(`Committed final batch of ${eventBatchCount} event deletes`);
    }

    logger.info(`Deleted ${eventCount} events`);

    // 2. Reset user fields
    logger.info('Step 2: Resetting user fields (pendingEvents, pendingEventCount)...');
    const usersSnapshot = await db.collection(Collections.USERS).get();
    let userUpdateCount = 0;

    const userBatch = db.batch();
    let userBatchCount = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      if (userData.pendingEvents?.length > 0 || userData.pendingEventCount > 0) {
        userBatch.update(doc.ref, {
          pendingEvents: [],
          pendingEventCount: 0,
        });
        userUpdateCount++;
        userBatchCount++;

        if (userBatchCount >= MAX_BATCH_SIZE) {
          await userBatch.commit();
          logger.info(`Committed batch of ${userBatchCount} user updates`);
          userBatchCount = 0;
        }
      }
    }

    if (userBatchCount > 0) {
      await userBatch.commit();
      logger.info(`Committed final batch of ${userBatchCount} user updates`);
    }

    logger.info(`Updated ${userUpdateCount} users`);

    // 3. Reset pair_matches fields
    logger.info('Step 3: Resetting pair_matches fields (pendingEventId)...');
    const pairMatchesSnapshot = await db.collection(Collections.PAIR_MATCHES).get();
    let pairMatchUpdateCount = 0;

    const pairBatch = db.batch();
    let pairBatchCount = 0;

    for (const doc of pairMatchesSnapshot.docs) {
      const pairData = doc.data();
      if (pairData.pendingEventId) {
        pairBatch.update(doc.ref, {
          pendingEventId: null,
        });
        pairMatchUpdateCount++;
        pairBatchCount++;

        if (pairBatchCount >= MAX_BATCH_SIZE) {
          await pairBatch.commit();
          logger.info(`Committed batch of ${pairBatchCount} pair_match updates`);
          pairBatchCount = 0;
        }
      }
    }

    if (pairBatchCount > 0) {
      await pairBatch.commit();
      logger.info(`Committed final batch of ${pairBatchCount} pair_match updates`);
    }

    logger.info(`Updated ${pairMatchUpdateCount} pair_matches`);

    // 4. Delete all event_participants
    logger.info('Step 4: Deleting all event_participants...');
    const participantsSnapshot = await db.collection(Collections.EVENT_PARTICIPANTS).get();
    const participantCount = participantsSnapshot.size;

    const participantBatch = db.batch();
    let participantBatchCount = 0;

    for (const doc of participantsSnapshot.docs) {
      participantBatch.delete(doc.ref);
      participantBatchCount++;

      if (participantBatchCount >= MAX_BATCH_SIZE) {
        await participantBatch.commit();
        logger.info(`Committed batch of ${participantBatchCount} participant deletes`);
        participantBatchCount = 0;
      }
    }

    if (participantBatchCount > 0) {
      await participantBatch.commit();
      logger.info(`Committed final batch of ${participantBatchCount} participant deletes`);
    }

    logger.info(`Deleted ${participantCount} event_participants`);

    logger.info('Cleanup completed successfully!');

    res.json({
      success: true,
      eventsDeleted: eventCount,
      usersUpdated: userUpdateCount,
      pairMatchesUpdated: pairMatchUpdateCount,
      participantsDeleted: participantCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Cleanup all events error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Clean up pair_matches by resetting pendingEventId and queueStatus.
 * This is useful after deleting events to make pair_matches eligible again.
 */
router.post('/cleanup-pair-matches', async (req, res) => {
  logger.info('Starting pair_matches cleanup');
  try {
    const pairMatchesSnap = await db.collection(Collections.PAIR_MATCHES).get();

    let updatedCount = 0;
    let alreadyCleanCount = 0;
    const batch = db.batch();
    let batchCount = 0;
    const MAX_BATCH_SIZE = 500;

    for (const doc of pairMatchesSnap.docs) {
      const data = doc.data();
      const needsUpdate = data.pendingEventId || data.queueStatus !== 'queued';

      if (needsUpdate) {
        batch.update(doc.ref, {
          pendingEventId: null,
          queueStatus: 'queued',
        });

        updatedCount++;
        batchCount++;

        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          logger.info(`Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }
      } else {
        alreadyCleanCount++;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      logger.info(`Committed final batch of ${batchCount} updates`);
    }

    // Get stats on queued matches
    const queuedSnap = await db.collection(Collections.PAIR_MATCHES)
      .where('queueStatus', '==', 'queued')
      .get();

    const queuedByType: { [key: string]: number } = {};
    queuedSnap.docs.forEach(doc => {
      const data = doc.data();
      if (!data.pendingEventId) {
        const eventType = data.queueEventType || 'unknown';
        queuedByType[eventType] = (queuedByType[eventType] || 0) + 1;
      }
    });

    logger.info('Cleanup completed', {
      total: pairMatchesSnap.size,
      updated: updatedCount,
      alreadyClean: alreadyCleanCount,
      queuedByType,
    });

    res.json({
      success: true,
      total: pairMatchesSnap.size,
      updated: updatedCount,
      alreadyClean: alreadyCleanCount,
      queuedByType,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Pair matches cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export const cronRoutes = router;
