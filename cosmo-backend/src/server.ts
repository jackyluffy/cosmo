// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { initializeApp } from './app';
import { logger } from './utils/logger';
import { gracefulShutdown } from './utils/shutdown';
import { EventOrchestrationService } from './services/event-orchestration.service';

// Debug: Log Twilio credentials to verify .env is loaded
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID);
console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? 'SET' : 'NOT SET');
console.log('TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER);

// Create Express app
const app = express();
const server = createServer(app);

// Trust proxy - important for Cloud Run (but disable in dev to avoid rate limiter issues)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
}));

// Compression
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
  app.use(morgan('combined', { stream: logger.stream }));
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
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      error: 'Database connection failed',
    });
  }
});

// Initialize application routes and middleware
initializeApp(app);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);

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
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔥 Firebase Project: ${process.env.PROJECT_ID || process.env.FIREBASE_PROJECT_ID}`);

  const defaultIntervalMs = 1 * 60 * 1000; // 1 minute (changed from 15 minutes for faster testing)
  const rawInterval = process.env.EVENT_QUEUE_POLL_INTERVAL_MS;
  const parsedInterval = rawInterval ? Number(rawInterval) : defaultIntervalMs;
  const intervalMs = Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : defaultIntervalMs;

  if (rawInterval && parsedInterval !== intervalMs) {
    logger.warn(
      `[AutoOrganize] Invalid EVENT_QUEUE_POLL_INTERVAL_MS value "${rawInterval}". Falling back to ${intervalMs}ms.`
    );
  }

  const autoOrganizeFlag = process.env.EVENT_QUEUE_AUTORUN;
  const autoOrganizeEnabled =
    (autoOrganizeFlag ? autoOrganizeFlag.toLowerCase() === 'true' : process.env.NODE_ENV === 'development');

  if (autoOrganizeEnabled) {
    logger.info(
      `[AutoOrganize] Background event queue polling enabled. Interval: ${intervalMs}ms (${Math.round(
        intervalMs / 1000
      )}s).`
    );

    const runAutoOrganize = async () => {
      try {
        const createdByType = await EventOrchestrationService.processAllQueues();
        logger.info('[AutoOrganize] Completed run', createdByType);
      } catch (error: any) {
        logger.error('[AutoOrganize] Failed to process event queues:', error);
      }
    };

    runAutoOrganize();
    setInterval(runAutoOrganize, intervalMs);
  } else {
    logger.info('[AutoOrganize] Background event queue polling disabled. Relying on external scheduler.');
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown(server));
process.on('SIGINT', () => gracefulShutdown(server));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown(server);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  gracefulShutdown(server);
});

export default server;
