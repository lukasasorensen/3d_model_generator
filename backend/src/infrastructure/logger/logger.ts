import winston from "winston";
import { config } from "../../config/config";

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length
          ? JSON.stringify(meta, null, 2)
          : "";
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      })
    ),
  }),
];

if (config.logging.logToFile) {
  transports.push(
    new winston.transports.File({
      filename: config.logging.logFilePath,
      maxsize: config.logging.maxLogFileSize,
      maxFiles: config.logging.maxLogFileCount,
    })
  );
}

export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports,
});
