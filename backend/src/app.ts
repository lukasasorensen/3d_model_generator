import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { createModelRoutes } from "./routes/models";
import { createConversationRoutes } from "./routes/conversations";
import { errorHandler } from "./middleware/errorHandler";
import { OpenAIService } from "./services/openaiService";
import { OpenSCADService } from "./services/openscadService";
import { FileStorageService } from "./services/fileStorageService";
import { ConversationService } from "./services/conversationService";
import { ModelController } from "./controllers/modelController";
import { ConversationController } from "./controllers/conversationController";
import * as path from "path";
import { config } from "./config/config";
import { logger } from "./infrastructure/logger/logger";

// Request logging middleware
function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 15);

  // Log request
  logger.info("Incoming request", {
    requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  // Capture response
  const originalEnd = res.end.bind(res);
  res.end = function (chunk?: any, encoding?: any, callback?: any) {
    const duration = Date.now() - startTime;
    logger.info("Request completed", {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
    return originalEnd(chunk, encoding, callback);
  };

  next();
}

export function createApp() {
  logger.debug("Initializing Express application");

  const app = express();
  const prisma = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
    ],
  });

  // Prisma logging
  prisma.$on("query" as never, (e: any) => {
    logger.debug("Prisma query", {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });

  prisma.$on("error" as never, (e: any) => {
    logger.error("Prisma error", { error: e.message });
  });

  prisma.$on("warn" as never, (e: any) => {
    logger.warn("Prisma warning", { warning: e.message });
  });

  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  logger.debug("Creating services");
  const openaiService = new OpenAIService(config.openai.apiKey);
  const openscadService = new OpenSCADService(
    path.join(__dirname, "../generated")
  );
  const fileStorage = new FileStorageService(
    path.join(__dirname, "../generated/scad"),
    path.join(__dirname, "../generated/stl"),
    path.join(__dirname, "../generated/3mf")
  );
  const conversationService = new ConversationService(prisma);
  logger.debug("Services created successfully");

  logger.debug("Creating controllers");
  const modelController = new ModelController(
    openaiService,
    openscadService,
    fileStorage
  );
  const conversationController = new ConversationController(
    conversationService,
    openaiService,
    openscadService,
    fileStorage
  );
  logger.debug("Controllers created successfully");

  logger.debug("Registering routes");
  app.get("/health", (req, res) => {
    logger.debug("Health check requested");
    res.json({ status: "ok" });
  });
  app.use("/api/models", createModelRoutes(modelController));
  app.use(
    "/api/conversations",
    createConversationRoutes(conversationController)
  );
  logger.debug("Routes registered successfully");

  app.use(errorHandler);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Disconnecting from database...");
    await prisma.$disconnect();
    logger.info("Database disconnected");
  };

  logger.info("Express application initialized successfully");
  return { app, fileStorage, prisma, shutdown };
}
