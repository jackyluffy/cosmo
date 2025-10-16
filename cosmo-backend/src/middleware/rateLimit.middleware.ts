import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Disable rate limiting in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// No-op middleware for development
const noopLimiter = (req: Request, res: Response, next: NextFunction) => next();

// Custom key generator that works with Cloud Run's proxy
const cloudRunKeyGenerator = (req: Request): string => {
  // In Cloud Run, the real IP is in x-forwarded-for header
  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIp = typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim()
    : req.ip || 'unknown';
  return clientIp;
};

// Different rate limits for different endpoints
const rateLimits = {
  auth: isDevelopment ? noopLimiter : rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDevelopment,
    keyGenerator: cloudRunKeyGenerator,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded:', {
        ip: req.ip,
        path: req.path,
      });
      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later',
      });
    },
  }),

  api: isDevelopment ? noopLimiter : rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests, please slow down',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDevelopment,
    keyGenerator: cloudRunKeyGenerator,
  }),

  upload: isDevelopment ? noopLimiter : rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: 'Upload limit reached, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDevelopment,
    keyGenerator: cloudRunKeyGenerator,
  }),

  stripe: isDevelopment ? noopLimiter : rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 payment attempts per hour
    message: 'Too many payment attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDevelopment,
    keyGenerator: cloudRunKeyGenerator,
  }),
};

export function rateLimiter(type: keyof typeof rateLimits = 'api') {
  return rateLimits[type] || rateLimits.api;
}