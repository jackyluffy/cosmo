import express from 'express';
import multer from 'multer';
import { authRoutes } from './routes/auth.routes';
import { profileRoutes } from './routes/profile.routes';
import { eventRoutes } from './routes/event.routes';
import { swipeRoutes } from './routes/swipe.routes';
import { chatRoutes } from './routes/chat.routes';
import { billingRoutes } from './routes/billing.routes';
import { cronRoutes } from './routes/cron.routes';
import { adminRoutes } from './routes/admin.routes';
import { mediaRoutes } from './routes/media.routes';
import verificationRoutes from './routes/verification.routes';
import { authenticate, requireCompleteProfile, requireActiveSubscription } from './middleware/auth.middleware';
import { rateLimiter } from './middleware/rateLimit.middleware';
import { validateRequest } from './middleware/validation.middleware';
import { logger } from './utils/logger';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export function initializeApp(app: express.Application) {
  logger.info('Initializing application routes...');

  // API version prefix
  const apiV1 = express.Router();

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
  apiV1.use('/auth', rateLimiter('auth'), authRoutes);

  // Profile routes (requires authentication)
  apiV1.use('/profile', authenticate, profileRoutes);

  // Verification routes (requires authentication)
  apiV1.use('/verification', authenticate, verificationRoutes);

  // Swipe/matching routes (requires complete profile)
  apiV1.use('/swipe', authenticate, requireCompleteProfile, swipeRoutes);

  // Event routes (requires authentication)
  apiV1.use('/events', authenticate, eventRoutes);

  // Chat routes (requires authentication)
  apiV1.use('/chat', authenticate, chatRoutes);

  // Billing routes (requires authentication)
  apiV1.use('/billing', authenticate, billingRoutes);

  // Admin routes (requires admin privileges)
  apiV1.use('/admin', authenticate, adminRoutes);

  // Cron/scheduled task routes (internal only)
  apiV1.use('/cron', cronRoutes);

  // Media proxy routes (public - no auth required for viewing images)
  apiV1.use('/media', mediaRoutes);

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

  logger.info('Application routes initialized');
}