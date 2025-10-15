import winston from 'winston';
import { pino } from 'pino';

// Use Pino for production (better performance)
// Use Winston for development (better formatting)

const isDevelopment = process.env.NODE_ENV !== 'production';

// Winston logger for development
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'cosmo-backend',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Pino logger for production
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { severity: label.toUpperCase() };
    },
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'message',
});

// Unified logger interface
export const logger = {
  info: (message: string, meta?: any) => {
    if (isDevelopment) {
      winstonLogger.info(message, meta);
    } else {
      pinoLogger.info(meta, message);
    }
  },

  error: (message: string, error?: any) => {
    if (isDevelopment) {
      winstonLogger.error(message, error);
    } else {
      pinoLogger.error(error, message);
    }
  },

  warn: (message: string, meta?: any) => {
    if (isDevelopment) {
      winstonLogger.warn(message, meta);
    } else {
      pinoLogger.warn(meta, message);
    }
  },

  debug: (message: string, meta?: any) => {
    if (isDevelopment) {
      winstonLogger.debug(message, meta);
    } else {
      pinoLogger.debug(meta, message);
    }
  },

  // Stream for Morgan HTTP logging
  stream: {
    write: (message: string) => {
      logger.info(message.trim());
    },
  },
};