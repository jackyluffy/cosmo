"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = rateLimiter;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = require("../utils/logger");
// Disable rate limiting in development mode
const isDevelopment = process.env.NODE_ENV === 'development';
// No-op middleware for development
const noopLimiter = (req, res, next) => next();
// Custom key generator that works with Cloud Run's proxy
const cloudRunKeyGenerator = (req) => {
    // In Cloud Run, the real IP is in x-forwarded-for header
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : req.ip || 'unknown';
    return clientIp;
};
// Different rate limits for different endpoints
const rateLimits = {
    auth: isDevelopment ? noopLimiter : (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 requests per window
        message: 'Too many authentication attempts, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => isDevelopment,
        keyGenerator: cloudRunKeyGenerator,
        handler: (req, res) => {
            logger_1.logger.warn('Rate limit exceeded:', {
                ip: req.ip,
                path: req.path,
            });
            res.status(429).json({
                success: false,
                error: 'Too many requests, please try again later',
            });
        },
    }),
    api: isDevelopment ? noopLimiter : (0, express_rate_limit_1.default)({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 100, // 100 requests per minute
        message: 'Too many requests, please slow down',
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => isDevelopment,
        keyGenerator: cloudRunKeyGenerator,
    }),
    upload: isDevelopment ? noopLimiter : (0, express_rate_limit_1.default)({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 20, // 20 uploads per hour
        message: 'Upload limit reached, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => isDevelopment,
        keyGenerator: cloudRunKeyGenerator,
    }),
    stripe: isDevelopment ? noopLimiter : (0, express_rate_limit_1.default)({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // 10 payment attempts per hour
        message: 'Too many payment attempts, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => isDevelopment,
        keyGenerator: cloudRunKeyGenerator,
    }),
};
function rateLimiter(type = 'api') {
    return rateLimits[type] || rateLimits.api;
}
//# sourceMappingURL=rateLimit.middleware.js.map