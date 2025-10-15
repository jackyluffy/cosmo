import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = createServer(app);

// Trust proxy - important for Cloud Run
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
}));

// Compression
app.use(compression());

// CORS configuration - Allow all origins for now to enable testing
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
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

// Test API endpoint
app.get('/api/v1/test', (req, res) => {
  res.json({
    success: true,
    message: 'Cosmo API is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Public test endpoint that bypasses organization restrictions
app.get('/public/test', (req, res) => {
  res.json({
    success: true,
    message: 'Cosmo Public API Test Successful! 🎉',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    server: 'Google Cloud Run',
    note: 'This endpoint is accessible without authentication'
  });
});

// Public health check
app.get('/public/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Cosmo backend is running on Cloud Run! ✅',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    server: 'Google Cloud Run'
  });
});

// ============================================
// Dating App API Endpoints
// ============================================

// Authentication endpoints
app.post('/api/v1/auth/otp/request', (req, res) => {
  res.json({
    success: true,
    message: 'OTP sent successfully',
    timestamp: new Date().toISOString(),
    note: 'Placeholder endpoint - will implement Twilio SMS integration'
  });
});

app.post('/api/v1/auth/otp/verify', (req, res) => {
  res.json({
    success: true,
    message: 'OTP verified successfully',
    token: 'jwt_token_placeholder',
    timestamp: new Date().toISOString(),
    note: 'Placeholder endpoint - will implement JWT authentication'
  });
});

// Profile endpoints
app.get('/api/v1/profile', (req, res) => {
  res.json({
    success: true,
    profile: {
      id: 'user123',
      name: 'Sample User',
      age: 25,
      bio: 'Sample bio',
      photos: [],
      preferences: {}
    },
    timestamp: new Date().toISOString(),
    note: 'Placeholder endpoint - will implement Firebase integration'
  });
});

app.put('/api/v1/profile', (req, res) => {
  res.json({
    success: true,
    message: 'Profile updated successfully',
    timestamp: new Date().toISOString(),
    note: 'Placeholder endpoint - will implement profile updates'
  });
});

// Swipe/Match endpoints
app.get('/api/v1/swipe/potential', (req, res) => {
  res.json({
    success: true,
    profiles: [
      {
        id: 'user456',
        name: 'Potential Match',
        age: 26,
        bio: 'Looking for meaningful connections',
        photos: []
      }
    ],
    timestamp: new Date().toISOString(),
    note: 'Placeholder endpoint - will implement matching algorithm'
  });
});

app.post('/api/v1/swipe', (req, res) => {
  res.json({
    success: true,
    match: false,
    message: 'Swipe recorded',
    timestamp: new Date().toISOString(),
    note: 'Placeholder endpoint - will implement swipe logic'
  });
});

// Event endpoints
app.get('/api/v1/events', (req, res) => {
  res.json({
    success: true,
    events: [
      {
        id: 'event123',
        title: 'Coffee Chat Group',
        description: 'Meet fellow coffee lovers',
        location: 'Downtown Coffee Shop',
        date: new Date().toISOString(),
        maxParticipants: 6,
        currentParticipants: 2
      }
    ],
    timestamp: new Date().toISOString(),
    note: 'Placeholder endpoint - will implement event system'
  });
});

app.post('/api/v1/events', (req, res) => {
  res.json({
    success: true,
    eventId: 'event' + Date.now(),
    message: 'Event created successfully',
    timestamp: new Date().toISOString(),
    note: 'Placeholder endpoint - will implement event creation'
  });
});

// Chat endpoints
app.get('/api/v1/chat/conversations', (req, res) => {
  res.json({
    success: true,
    conversations: [
      {
        id: 'conv123',
        participants: ['user123', 'user456'],
        lastMessage: {
          text: 'Hello there!',
          timestamp: new Date().toISOString()
        }
      }
    ],
    timestamp: new Date().toISOString(),
    note: 'Placeholder endpoint - will implement chat system'
  });
});

app.post('/api/v1/chat/send', (req, res) => {
  res.json({
    success: true,
    messageId: 'msg' + Date.now(),
    message: 'Message sent successfully',
    timestamp: new Date().toISOString(),
    note: 'Placeholder endpoint - will implement message sending'
  });
});

// Billing endpoints
app.get('/api/v1/billing/subscription', (req, res) => {
  res.json({
    success: true,
    subscription: {
      plan: 'free',
      status: 'active',
      expires: null
    },
    timestamp: new Date().toISOString(),
    note: 'Placeholder endpoint - will implement Stripe integration'
  });
});

app.post('/api/v1/billing/upgrade', (req, res) => {
  res.json({
    success: true,
    message: 'Upgrade request received',
    timestamp: new Date().toISOString(),
    note: 'Placeholder endpoint - will implement payment processing'
  });
});

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
  console.error('Unhandled error:', err);

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
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

export default server;