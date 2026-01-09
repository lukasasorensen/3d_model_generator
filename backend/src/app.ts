import express from "express";
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

export function createApp() {
  const app = express();
  const prisma = new PrismaClient();

  app.use(cors());
  app.use(express.json());

  const openaiService = new OpenAIService(process.env.OPENAI_API_KEY!);
  const openscadService = new OpenSCADService(
    path.join(__dirname, "../generated")
  );
  const fileStorage = new FileStorageService(
    path.join(__dirname, "../generated/scad"),
    path.join(__dirname, "../generated/stl"),
    path.join(__dirname, "../generated/3mf")
  );
  const conversationService = new ConversationService(prisma);

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

  app.get("/health", (req, res) => res.json({ status: "ok" }));
  app.use("/api/models", createModelRoutes(modelController));
  app.use(
    "/api/conversations",
    createConversationRoutes(conversationController)
  );

  app.use(errorHandler);

  // Graceful shutdown
  const shutdown = async () => {
    await prisma.$disconnect();
  };

  return { app, fileStorage, prisma, shutdown };
}
