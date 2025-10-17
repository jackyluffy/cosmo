"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cronRoutes = void 0;
const express_1 = require("express");
const matching_service_1 = require("../services/matching.service");
const event_reminder_service_1 = require("../services/event-reminder.service");
const event_orchestration_service_1 = require("../services/event-orchestration.service");
const logger_1 = require("../utils/logger");
const firebase_1 = require("../config/firebase");
const firestore_1 = require("firebase-admin/firestore");
const router = (0, express_1.Router)();
// Middleware to verify cron secret
const verifyCronSecret = (req, res, next) => {
    const cronSecret = req.headers['x-cron-secret'];
    if (cronSecret !== process.env.CRON_SECRET) {
        logger_1.logger.warn('Unauthorized cron job attempt');
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
    logger_1.logger.info('Starting daily matching algorithm');
    try {
        // Get events happening in the next 3 days
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        const eventsSnapshot = await firebase_1.db.collection(firebase_1.Collections.EVENTS)
            .where('status', '==', 'published')
            .where('starts_at', '>', firestore_1.Timestamp.now())
            .where('starts_at', '<', firestore_1.Timestamp.fromDate(threeDaysFromNow))
            .get();
        logger_1.logger.info(`Found ${eventsSnapshot.size} upcoming events`);
        // Run matching for each event
        const results = [];
        for (const eventDoc of eventsSnapshot.docs) {
            try {
                await matching_service_1.MatchingService.runMatchingForEvent(eventDoc.id);
                results.push({ eventId: eventDoc.id, status: 'success' });
            }
            catch (error) {
                logger_1.logger.error(`Matching failed for event ${eventDoc.id}:`, error);
                results.push({ eventId: eventDoc.id, status: 'error', error: error.message });
            }
        }
        logger_1.logger.info('Daily matching completed');
        res.json({
            success: true,
            eventsProcessed: eventsSnapshot.size,
            results,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.logger.error('Daily matching error:', error);
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
    logger_1.logger.info('Starting OTP cleanup');
    try {
        // Delete OTP codes older than 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const otpSnapshot = await firebase_1.db.collection(firebase_1.Collections.OTP_CODES)
            .where('createdAt', '<', firestore_1.Timestamp.fromDate(yesterday))
            .get();
        const batch = firebase_1.db.batch();
        otpSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        logger_1.logger.info(`Deleted ${otpSnapshot.size} expired OTP codes`);
        res.json({
            success: true,
            deletedCount: otpSnapshot.size,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.logger.error('OTP cleanup error:', error);
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
    logger_1.logger.info('Starting daily notifications');
    try {
        // Get inactive users (no activity in last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const inactiveUsersSnapshot = await firebase_1.db.collection(firebase_1.Collections.USERS)
            .where('lastActive', '<', firestore_1.Timestamp.fromDate(sevenDaysAgo))
            .where('notifications.engagement', '==', true)
            .limit(100) // Process in batches
            .get();
        logger_1.logger.info(`Found ${inactiveUsersSnapshot.size} inactive users`);
        // TODO: Send engagement notifications
        // This would integrate with your notification service
        res.json({
            success: true,
            usersNotified: inactiveUsersSnapshot.size,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.logger.error('Daily notifications error:', error);
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
    logger_1.logger.info('Updating subscription statuses');
    try {
        const now = firestore_1.Timestamp.now();
        // Find expired subscriptions
        const expiredSubscriptionsSnapshot = await firebase_1.db.collection(firebase_1.Collections.SUBSCRIPTIONS)
            .where('status', '==', 'active')
            .where('expiresAt', '<', now)
            .get();
        logger_1.logger.info(`Found ${expiredSubscriptionsSnapshot.size} expired subscriptions`);
        const batch = firebase_1.db.batch();
        expiredSubscriptionsSnapshot.docs.forEach((doc) => {
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
    }
    catch (error) {
        logger_1.logger.error('Subscription update error:', error);
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
    logger_1.logger.info('Generating weekly analytics');
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        // Collect various metrics
        const [newUsersSnapshot, eventsSnapshot, matchesSnapshot,] = await Promise.all([
            firebase_1.db.collection(firebase_1.Collections.USERS)
                .where('createdAt', '>', firestore_1.Timestamp.fromDate(oneWeekAgo))
                .get(),
            firebase_1.db.collection(firebase_1.Collections.EVENTS)
                .where('createdAt', '>', firestore_1.Timestamp.fromDate(oneWeekAgo))
                .get(),
            firebase_1.db.collection(firebase_1.Collections.MATCHES)
                .where('createdAt', '>', firestore_1.Timestamp.fromDate(oneWeekAgo))
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
        await firebase_1.db.collection(firebase_1.Collections.ANALYTICS).add({
            type: 'weekly_report',
            data: analytics,
            createdAt: firestore_1.Timestamp.now(),
        });
        logger_1.logger.info('Weekly analytics generated:', analytics);
        res.json({
            success: true,
            analytics,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.logger.error('Analytics generation error:', error);
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
    logger_1.logger.info('Starting auto event orchestration');
    try {
        const createdByType = await event_orchestration_service_1.EventOrchestrationService.processAllQueues();
        logger_1.logger.info('Auto event orchestration completed', createdByType);
        res.json({
            success: true,
            createdEvents: createdByType,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.logger.error('Auto event orchestration error:', error);
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
    logger_1.logger.info('Running event reminder scheduler');
    try {
        const result = await event_reminder_service_1.EventReminderService.sendUpcomingEventReminders();
        res.json({
            success: true,
            processed: result.processed,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.logger.error('Event reminder error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
exports.cronRoutes = router;
//# sourceMappingURL=cron.routes.js.map