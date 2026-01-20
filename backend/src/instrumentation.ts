import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { Resource } from "@opentelemetry/resources";
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { config } from "./config/config";

// Read OTEL config from centralized config
const { enabled: otelEnabled, serviceName, otlpEndpoint, debug: otelDebug } = config.otel;
const serviceVersion = process.env.npm_package_version || "1.0.0";

// Enable debug logging if requested
if (otelDebug) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

let sdk: NodeSDK | null = null;

if (otelEnabled) {
  console.log(`[OTEL] Initializing OpenTelemetry instrumentation...`);
  console.log(`[OTEL] Service: ${serviceName}@${serviceVersion}`);
  console.log(`[OTEL] OTLP Endpoint: ${otlpEndpoint}`);

  // Create resource with service information
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
  });

  // Create OTLP exporters
  const traceExporter = new OTLPTraceExporter({
    url: otlpEndpoint,
  });

  const metricExporter = new OTLPMetricExporter({
    url: otlpEndpoint,
  });

  const logExporter = new OTLPLogExporter({
    url: otlpEndpoint,
  });

  // Create metric reader with periodic export
  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 10000, // Export metrics every 10 seconds
  });

  // Create log record processor
  const logRecordProcessor = new BatchLogRecordProcessor(logExporter);

  // Initialize the SDK with auto-instrumentation
  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    logRecordProcessor,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation to reduce noise
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
        // Configure HTTP instrumentation
        "@opentelemetry/instrumentation-http": {
          ignoreIncomingRequestHook: (request) => {
            // Ignore health check endpoints
            return request.url === "/health";
          },
        },
        // Enable Express instrumentation
        "@opentelemetry/instrumentation-express": {
          enabled: true,
        },
        // Enable Winston instrumentation for log correlation
        "@opentelemetry/instrumentation-winston": {
          enabled: true,
          logHook: (span, record) => {
            // Add trace context to log records
            record["trace_id"] = span.spanContext().traceId;
            record["span_id"] = span.spanContext().spanId;
          },
        },
      }),
    ],
  });

  // Start the SDK
  sdk.start();
  console.log(`[OTEL] OpenTelemetry instrumentation started successfully`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[OTEL] Shutting down OpenTelemetry...");
    try {
      await sdk?.shutdown();
      console.log("[OTEL] OpenTelemetry shut down successfully");
    } catch (error) {
      console.error("[OTEL] Error shutting down OpenTelemetry:", error);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
} else {
  console.log(
    "[OTEL] OpenTelemetry disabled (set OTEL_ENABLED=true to enable)"
  );
}

export { sdk };
