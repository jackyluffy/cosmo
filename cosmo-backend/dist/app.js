"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeApp = initializeApp;
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const firestore_1 = require("firebase-admin/firestore");
const auth_routes_1 = require("./routes/auth.routes");
const profile_routes_1 = require("./routes/profile.routes");
const event_routes_1 = require("./routes/event.routes");
const swipe_routes_1 = require("./routes/swipe.routes");
const chat_routes_1 = require("./routes/chat.routes");
const billing_routes_1 = require("./routes/billing.routes");
const cron_routes_1 = require("./routes/cron.routes");
const admin_routes_1 = require("./routes/admin.routes");
const media_routes_1 = require("./routes/media.routes");
const verification_routes_1 = __importDefault(require("./routes/verification.routes"));
const auth_middleware_1 = require("./middleware/auth.middleware");
const rateLimit_middleware_1 = require("./middleware/rateLimit.middleware");
const logger_1 = require("./utils/logger");
// Configure multer for file uploads
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        // Accept only images
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    },
});
// Middleware to convert Firestore Timestamps to ISO strings in JSON responses
function serializeFirestoreTimestamps(obj) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    // Handle Firestore Timestamp objects
    if (obj instanceof firestore_1.Timestamp || (obj.constructor && obj.constructor.name === 'Timestamp')) {
        return obj.toDate().toISOString();
    }
    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(serializeFirestoreTimestamps);
    }
    // Handle plain objects
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = serializeFirestoreTimestamps(value);
    }
    return result;
}
function initializeApp(app) {
    logger_1.logger.info('Initializing application routes...');
    // Add middleware to serialize Firestore Timestamps in all responses
    app.use((req, res, next) => {
        const originalJson = res.json.bind(res);
        res.json = function (data) {
            const serialized = serializeFirestoreTimestamps(data);
            return originalJson(serialized);
        };
        next();
    });
    // API version prefix
    const apiV1 = express_1.default.Router();
    // ============================================
    // Public endpoints (no authentication required)
    // ============================================
    app.get('/public/health', (req, res) => {
        res.json({
            success: true,
            status: 'healthy',
            message: 'Cosmo API is running! 🚀',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            version: '1.0.0'
        });
    });
    app.get('/public/test', (req, res) => {
        res.json({
            success: true,
            message: 'Public test endpoint is working! 🎉',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            endpoints: {
                public: ['/public/health'],
                auth: ['/api/v1/auth/otp/request', '/api/v1/auth/otp/verify'],
                protected: ['/api/v1/profile', '/api/v1/swipe', '/api/v1/events', '/api/v1/chat', '/api/v1/billing']
            }
        });
    });
    // DEV ONLY: Public seed endpoint (no auth required)
    if (process.env.NODE_ENV === 'development') {
        const { AdminController } = require('./routes/admin.routes');
        apiV1.post('/admin/seed-users', AdminController.seedUsers);
    }
    // Public test user generation endpoint (no auth for testing)
    const { AdminController } = require('./routes/admin.routes');
    apiV1.post('/admin/generate-test-users', AdminController.generateTestUsers);
    apiV1.post('/admin/update-test-user-profiles', AdminController.updateTestUserProfiles);
    // Authentication routes (public)
    apiV1.use('/auth', (0, rateLimit_middleware_1.rateLimiter)('auth'), auth_routes_1.authRoutes);
    // Profile routes (requires authentication)
    apiV1.use('/profile', auth_middleware_1.authenticate, profile_routes_1.profileRoutes);
    // Verification routes (requires authentication)
    apiV1.use('/verification', auth_middleware_1.authenticate, verification_routes_1.default);
    // Swipe/matching routes (requires complete profile)
    apiV1.use('/swipe', auth_middleware_1.authenticate, auth_middleware_1.requireCompleteProfile, swipe_routes_1.swipeRoutes);
    // Event routes (requires authentication)
    apiV1.use('/events', auth_middleware_1.authenticate, event_routes_1.eventRoutes);
    // Chat routes (requires authentication)
    apiV1.use('/chat', auth_middleware_1.authenticate, chat_routes_1.chatRoutes);
    // Billing routes (requires authentication)
    apiV1.use('/billing', auth_middleware_1.authenticate, billing_routes_1.billingRoutes);
    // Admin routes (requires admin privileges)
    apiV1.use('/admin', auth_middleware_1.authenticate, admin_routes_1.adminRoutes);
    // Cron/scheduled task routes (internal only)
    apiV1.use('/cron', cron_routes_1.cronRoutes);
    // Media proxy routes (public - no auth required for viewing images)
    apiV1.use('/media', media_routes_1.mediaRoutes);
    // Mount API routes
    app.use('/api/v1', apiV1);
    // Legacy API support (redirect to v1)
    app.use('/api', (req, res, next) => {
        req.url = `/api/v1${req.url}`;
        next();
    });
    // ============================================
    // Metrics & Monitoring
    // ============================================
    app.get('/metrics', (req, res) => {
        // Prometheus-style metrics
        const metrics = {
            node_version: process.version,
            memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            uptime_seconds: process.uptime(),
            timestamp: new Date().toISOString(),
        };
        res.json(metrics);
    });
    logger_1.logger.info('Application routes initialized');
}
//# sourceMappingURL=app.js.map