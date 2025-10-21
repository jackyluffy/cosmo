"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables FIRST, before any other imports
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const http_1 = require("http");
const app_1 = require("./app");
const logger_1 = require("./utils/logger");
const shutdown_1 = require("./utils/shutdown");
const event_orchestration_service_1 = require("./services/event-orchestration.service");
// Debug: Log Twilio credentials to verify .env is loaded
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID);
console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? 'SET' : 'NOT SET');
console.log('TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER);
// Create Express app
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// Trust proxy - important for Cloud Run (but disable in dev to avoid rate limiter issues)
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', true);
}
// Security middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable for API
}));
// Compression
app.use((0, compression_1.default)());
// CORS configuration
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
}));
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Debug middleware to log request body
app.use((req, res, next) => {
    if (req.method === 'PUT' && req.path.includes('/api/v1/profile')) {
        console.log('[Server Middleware] PUT /api/v1/profile');
        console.log('[Server Middleware] Content-Type:', req.headers['content-type']);
        console.log('[Server Middleware] req.body:', JSON.stringify(req.body, null, 2));
    }
    // Log ALL verification requests
    if (req.path.includes('/verification')) {
        console.log('\n========== VERIFICATION REQUEST RECEIVED ==========');
        console.log('[Server Middleware] Method:', req.method);
        console.log('[Server Middleware] Path:', req.path);
        console.log('[Server Middleware] Full URL:', req.url);
        console.log('[Server Middleware] Content-Type:', req.headers['content-type']);
        console.log('[Server Middleware] Authorization:', req.headers.authorization ? 'Present' : 'Missing');
        console.log('[Server Middleware] Body size:', JSON.stringify(req.body).length, 'bytes');
        console.log('[Server Middleware] Has selfieBase64:', !!req.body?.selfieBase64);
        console.log('[Server Middleware] Has profilePhotos:', !!req.body?.profilePhotos);
        console.log('===================================================\n');
    }
    next();
});
// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use((0, morgan_1.default)('combined', { stream: logger_1.logger.stream }));
}
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
    });
});
// Readiness check endpoint
app.get('/ready', async (req, res) => {
    try {
        // Check database connection
        const { db } = require('./config/firebase');
        await db.collection('_health').doc('check').set({
            timestamp: new Date().toISOString(),
        });
        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.logger.error('Readiness check failed:', error);
        res.status(503).json({
            status: 'not ready',
            error: 'Database connection failed',
        });
    }
});
// Initialize application routes and middleware
(0, app_1.initializeApp)(app);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
    });
});
// Global error handler
app.use((err, req, res, next) => {
    logger_1.logger.error('Unhandled error:', err);
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';
    res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});
// Start server
const PORT = parseInt(process.env.PORT || '8080', 10);
server.listen(PORT, '0.0.0.0', () => {
    logger_1.logger.info(`🚀 Server running on port ${PORT}`);
    logger_1.logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger_1.logger.info(`🔥 Firebase Project: ${process.env.PROJECT_ID || process.env.FIREBASE_PROJECT_ID}`);
    const defaultIntervalMs = 1 * 60 * 1000; // 1 minute (changed from 15 minutes for faster testing)
    const rawInterval = process.env.EVENT_QUEUE_POLL_INTERVAL_MS;
    const parsedInterval = rawInterval ? Number(rawInterval) : defaultIntervalMs;
    const intervalMs = Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : defaultIntervalMs;
    if (rawInterval && parsedInterval !== intervalMs) {
        logger_1.logger.warn(`[AutoOrganize] Invalid EVENT_QUEUE_POLL_INTERVAL_MS value "${rawInterval}". Falling back to ${intervalMs}ms.`);
    }
    const autoOrganizeFlag = process.env.EVENT_QUEUE_AUTORUN;
    const autoOrganizeEnabled = (autoOrganizeFlag ? autoOrganizeFlag.toLowerCase() === 'true' : process.env.NODE_ENV === 'development');
    if (autoOrganizeEnabled) {
        logger_1.logger.info(`[AutoOrganize] Background event queue polling enabled. Interval: ${intervalMs}ms (${Math.round(intervalMs / 1000)}s).`);
        const runAutoOrganize = async () => {
            try {
                const createdByType = await event_orchestration_service_1.EventOrchestrationService.processAllQueues();
                logger_1.logger.info('[AutoOrganize] Completed run', createdByType);
            }
            catch (error) {
                logger_1.logger.error('[AutoOrganize] Failed to process event queues:', error);
            }
        };
        runAutoOrganize();
        setInterval(runAutoOrganize, intervalMs);
    }
    else {
        logger_1.logger.info('[AutoOrganize] Background event queue polling disabled. Relying on external scheduler.');
    }
});
// Handle graceful shutdown
process.on('SIGTERM', () => (0, shutdown_1.gracefulShutdown)(server));
process.on('SIGINT', () => (0, shutdown_1.gracefulShutdown)(server));
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught Exception:', error);
    (0, shutdown_1.gracefulShutdown)(server);
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled Rejection at:', { promise, reason });
    (0, shutdown_1.gracefulShutdown)(server);
});
exports.default = server;
//# sourceMappingURL=server.js.map