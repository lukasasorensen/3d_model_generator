// OpenTelemetry instrumentation must be imported first
import "./instrumentation";

import { createApp } from "./app";
import { OpenSCADService } from "./services/openscadService";
import * as path from "path";
import { config } from "./config/config";
import { logger } from "./infrastructure/logger/logger";

const PORT = config.server.port;

function buildDatabaseUrl(): string {
  const host = config.db.host;
  const port = config.db.port;
  const user = config.db.username;
  const password = config.db.password;
  const database = config.db.database;

  const missingVars: string[] = [];
  if (!host) missingVars.push("db.host");
  if (!user) missingVars.push("db.username");
  if (!password) missingVars.push("db.password");
  if (!database) missingVars.push("db.database");

  if (missingVars.length > 0) {
    logger.error("Missing required database environment variables", {
      missingVars,
    });
    logger.error("Please set the following in backend/.env:", {
      required: [
        "db.host=localhost",
        "POSTGRES_PORT=5432 (optional, defaults to 5432)",
        "db.username=ai_openscad",
        "db.password=ai_openscad_dev",
        "db.database=ai_openscad",
      ],
    });
    process.exit(1);
  }

  logger.debug("Database configuration validated", {
    host,
    port,
    database,
    user,
  });

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

async function startServer() {
  logger.info("Starting OpenSCAD AI Model Generator Backend...");

  if (!config.openai.apiKey) {
    logger.error("OPENAI_API_KEY environment variable is not set");
    process.exit(1);
  }
  logger.debug("OpenAI API key validated");

  // Build DATABASE_URL from individual components for Prisma
  config.db.url = buildDatabaseUrl();
  logger.info("Database URL configured");

  const openscadService = new OpenSCADService(
    path.join(__dirname, "../generated")
  );

  logger.debug("Checking OpenSCAD installation...");
  const isInstalled = await openscadService.checkInstallation();

  if (!isInstalled) {
    logger.error("OpenSCAD is not installed or not in PATH", {
      instructions: {
        macOS: "brew install openscad",
        Linux: "sudo apt-get install openscad",
        Windows: "Download from https://openscad.org/downloads.html",
      },
    });
    process.exit(1);
  }
  logger.info("OpenSCAD installation verified");

  const { app, fileStorage, shutdown } = createApp();
  logger.debug("Express application created");

  await fileStorage.initialize();
  logger.info("File storage initialized");

  const server = app.listen(PORT, () => {
    logger.info("========================================");
    logger.info("  OpenSCAD AI Model Generator Backend");
    logger.info("========================================");
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
    logger.info("OpenSCAD installation: ✓");
    logger.info("OpenAI API key: ✓");
    logger.info("Database: ✓");
    logger.info(
      `OpenTelemetry: ${config.otel.enabled ? "✓ (" + config.otel.otlpEndpoint + ")" : "disabled"}`
    );
    logger.info("Ready to generate 3D models!");
    logger.info("========================================");
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    server.close(async () => {
      logger.info("HTTP server closed");
      await shutdown();
      logger.info("All connections closed, exiting");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled rejection", { reason, promise });
  });
}

startServer().catch((error) => {
  logger.error("Failed to start server", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
