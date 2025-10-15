import { Server } from 'http';
import { logger } from './logger';

const SHUTDOWN_TIMEOUT = 10000; // 10 seconds

export async function gracefulShutdown(server: Server): Promise<void> {
  logger.info('Received shutdown signal, starting graceful shutdown...');

  // Set a timeout for forceful shutdown
  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    // Stop accepting new connections
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    logger.info('HTTP server closed');

    // Close database connections
    try {
      const { db } = require('../config/firebase');
      await db.terminate();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database connections:', error);
    }

    // Clear timeout
    clearTimeout(shutdownTimeout);

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}