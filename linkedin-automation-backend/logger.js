/**
 * Logger Module using Pino
 * Provides structured JSON logging with file rotation
 */

const pino = require('pino');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create the logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  
  // Formatter for human-readable console output
  transport: {
    targets: [
      // Console output (pretty printed)
      {
        target: 'pino-pretty',
        level: 'info',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      },
      
      // File output (JSON - for parsing)
      {
        target: 'pino/file',
        level: 'info',
        options: {
          destination: path.join(logsDir, 'app.log'),
          mkdir: true
        }
      }
    ]
  },
  
  // Add timestamp in ISO format
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  
  // Base properties
  base: {
    app: 'linkedin-automation'
  }
});

// Create child loggers for different modules
const createModuleLogger = (moduleName) => logger.child({ module: moduleName });

module.exports = {
  logger,
  createModuleLogger
};

