"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gracefulShutdown = gracefulShutdown;
const logger_1 = require("./logger");
const SHUTDOWN_TIMEOUT = 10000; // 10 seconds
async function gracefulShutdown(server) {
    logger_1.logger.info('Received shutdown signal, starting graceful shutdown...');
    // Set a timeout for forceful shutdown
    const shutdownTimeout = setTimeout(() => {
        logger_1.logger.error('Graceful shutdown timeout exceeded, forcing exit');
        process.exit(1);
    }, SHUTDOWN_TIMEOUT);
    try {
        // Stop accepting new connections
        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
        logger_1.logger.info('HTTP server closed');
        // Close database connections
        try {
            const { db } = require('../config/firebase');
            await db.terminate();
            logger_1.logger.info('Database connections closed');
        }
        catch (error) {
            logger_1.logger.error('Error closing database connections:', error);
        }
        // Clear timeout
        clearTimeout(shutdownTimeout);
        logger_1.logger.info('Graceful shutdown completed');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Error during graceful shutdown:', error);
        clearTimeout(shutdownTimeout);
        process.exit(1);
    }
}
//# sourceMappingURL=shutdown.js.map