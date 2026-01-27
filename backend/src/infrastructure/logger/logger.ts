import winston from 'winston';
import { config } from '../../config/config';
import { trace, context } from '@opentelemetry/api';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';

// Custom format to add trace context to log output
const traceFormat = winston.format((info) => {
  const span = trace.getSpan(context.active());
  if (span) {
    const spanContext = span.spanContext();
    info.trace_id = spanContext.traceId;
    info.span_id = spanContext.spanId;
  }
  return info;
});

// Console format with optional trace context display
const consoleFormat = winston.format.printf(({ timestamp, level, message, trace_id, span_id, ...meta }) => {
  // Build trace context string if available
  const traceIdStr = trace_id as string | undefined;
  const traceInfo = traceIdStr && config.otel.enabled ? ` [trace:${traceIdStr.slice(0, 8)}]` : '';

  // Build metadata string (exclude trace fields from display)
  const filteredMeta = { ...meta };
  delete filteredMeta.trace_id;
  delete filteredMeta.span_id;
  const metaStr = Object.keys(filteredMeta).length ? JSON.stringify(filteredMeta, null, 2) : '';

  return `${timestamp} [${level}]${traceInfo}: ${message} ${metaStr}`;
});

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), consoleFormat)
  })
];

if (config.logging.logToFile) {
  transports.push(
    new winston.transports.File({
      filename: config.logging.logFilePath,
      maxsize: config.logging.maxLogFileSize,
      maxFiles: config.logging.maxLogFileCount
    })
  );
}

// Add OpenTelemetry transport when enabled
if (config.otel.enabled) {
  transports.push(new OpenTelemetryTransportV3());
}

export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    traceFormat(),
    winston.format.json()
  ),
  transports
});
