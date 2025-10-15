"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const pino_1 = require("pino");
// Use Pino for production (better performance)
// Use Winston for development (better formatting)
const isDevelopment = process.env.NODE_ENV !== 'production';
// Winston logger for development
const winstonLogger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: {
        service: 'cosmo-backend',
        environment: process.env.NODE_ENV || 'development',
    },
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
        }),
    ],
});
// Pino logger for production
const pinoLogger = (0, pino_1.pino)({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => {
            return { severity: label.toUpperCase() };
        },
    },
    serializers: {
        req: pino_1.pino.stdSerializers.req,
        res: pino_1.pino.stdSerializers.res,
        err: pino_1.pino.stdSerializers.err,
    },
    timestamp: pino_1.pino.stdTimeFunctions.isoTime,
    messageKey: 'message',
});
// Unified logger interface
exports.logger = {
    info: (message, meta) => {
        if (isDevelopment) {
            winstonLogger.info(message, meta);
        }
        else {
            pinoLogger.info(meta, message);
        }
    },
    error: (message, error) => {
        if (isDevelopment) {
            winstonLogger.error(message, error);
        }
        else {
            pinoLogger.error(error, message);
        }
    },
    warn: (message, meta) => {
        if (isDevelopment) {
            winstonLogger.warn(message, meta);
        }
        else {
            pinoLogger.warn(meta, message);
        }
    },
    debug: (message, meta) => {
        if (isDevelopment) {
            winstonLogger.debug(message, meta);
        }
        else {
            pinoLogger.debug(meta, message);
        }
    },
    // Stream for Morgan HTTP logging
    stream: {
        write: (message) => {
            exports.logger.info(message.trim());
        },
    },
};
//# sourceMappingURL=logger.js.map