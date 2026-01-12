import { Request, Response } from "express";
import { ConversationService } from "../services/conversationService";
import {
  OpenScadAiService,
  OpenScadStreamEvent,
} from "../services/openScadAiService";
import { OpenSCADService } from "../services/openscadService";
import { FileStorageService } from "../services/fileStorageService";
import {
  CreateConversationRequest,
  AddMessageRequest,
} from "../../../shared/src/types/model";
import { logger } from "../infrastructure/logger/logger";
import {
  SSE_EVENTS,
  setSseHeaders,
  writeAiStreamEvent,
  writeSse,
} from "../utils/sseUtils";

export class ConversationController {
  constructor(
    private conversationService: ConversationService,
    private openScadAiService: OpenScadAiService,
    private openscadService: OpenSCADService,
    private fileStorage: FileStorageService
  ) {
    logger.debug("ConversationController initialized");
  }

  async listConversations(req: Request, res: Response): Promise<void> {
    logger.info("Listing all conversations");
    try {
      const conversations = await this.conversationService.listConversations();
      logger.info("Conversations listed successfully", {
        count: conversations.length,
      });
      res.json({
        success: true,
        data: conversations,
      });
    } catch (error: any) {
      logger.error("Error listing conversations", {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list conversations",
      });
    }
  }

  async getConversation(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    logger.info("Getting conversation", { conversationId: id });

    try {
      const conversation = await this.conversationService.getConversation(id);

      if (!conversation) {
        logger.warn("Conversation not found", { conversationId: id });
        res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
        return;
      }

      logger.info("Conversation retrieved successfully", {
        conversationId: id,
        messageCount: conversation.messages.length,
      });
      res.json({
        success: true,
        data: conversation,
      });
    } catch (error: any) {
      logger.error("Error getting conversation", {
        conversationId: id,
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get conversation",
      });
    }
  }

  async createConversation(req: Request, res: Response): Promise<void> {
    const { prompt, format = "stl" } = req.body as CreateConversationRequest;
    logger.info("Creating new conversation", {
      promptLength: prompt?.length,
      format,
    });

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      logger.warn("Invalid prompt provided", { prompt });
      res.status(400).json({
        success: false,
        error: "Prompt is required and must be a non-empty string",
      });
      return;
    }

    if (prompt.length > 1000) {
      logger.warn("Prompt too long", { promptLength: prompt.length });
      res.status(400).json({
        success: false,
        error: "Prompt is too long (maximum 1000 characters)",
      });
      return;
    }

    if (format !== "stl" && format !== "3mf") {
      logger.warn("Invalid format specified", { format });
      res.status(400).json({
        success: false,
        error: 'Format must be either "stl" or "3mf"',
      });
      return;
    }

    // Set up SSE
    setSseHeaders(res);
    logger.debug("SSE connection established for conversation creation");

    try {
      // Create the conversation
      const conversation = await this.conversationService.createConversation();
      logger.info("Conversation created", { conversationId: conversation.id });

      writeSse(res, SSE_EVENTS.conversationCreated, {
        conversationId: conversation.id,
      });

      // Add user message
      await this.conversationService.addUserMessage(conversation.id, prompt);
      logger.debug("User message added to conversation", {
        conversationId: conversation.id,
      });

      writeSse(res, SSE_EVENTS.generationStart, {
        message: "Generating OpenSCAD code...",
      });

      // Get messages for context
      const messages = await this.conversationService.getConversationMessages(
        conversation.id
      );
      logger.debug("Retrieved conversation messages for AI context", {
        conversationId: conversation.id,
        messageCount: messages.length,
      });

      // Generate code with event-based streaming
      logger.info("Starting OpenSCAD code generation", {
        conversationId: conversation.id,
      });

      let scadCode = "";
      let chunkCount = 0;

      scadCode = await this.openScadAiService.generateCode(
        messages,
        (event: OpenScadStreamEvent) => {
          if (event.type === "code_delta") {
            chunkCount++;
          }
          writeAiStreamEvent(res, event);
        }
      );

      logger.info("Code generation completed", {
        conversationId: conversation.id,
        codeLength: scadCode.length,
        chunkCount,
      });

      // Save SCAD file
      const { id: fileId, filePath: scadPath } =
        await this.fileStorage.saveScadFile(scadCode);
      logger.debug("SCAD file saved", { fileId, scadPath });

      writeSse(res, SSE_EVENTS.compiling, {
        message: "Compiling with OpenSCAD...",
      });

      // Generate 3D model
      logger.info("Compiling 3D model", {
        conversationId: conversation.id,
        format,
        fileId,
      });
      const outputPath = this.fileStorage.getOutputPath(fileId, format);
      if (format === "stl") {
        await this.openscadService.generateSTL(scadPath, outputPath);
      } else {
        await this.openscadService.generate3MF(scadPath, outputPath);
      }
      logger.info("3D model compiled successfully", {
        conversationId: conversation.id,
        format,
        outputPath,
      });

      const modelUrl = `/api/models/${fileId}/${format}`;

      // Save assistant message
      const assistantMessage =
        await this.conversationService.addAssistantMessage(
          conversation.id,
          `Generated model for: ${prompt}`,
          scadCode,
          modelUrl,
          format
        );
      logger.debug("Assistant message saved", {
        conversationId: conversation.id,
        messageId: assistantMessage.id,
      });

      // Get updated conversation
      const updatedConversation =
        await this.conversationService.getConversation(conversation.id);

      writeSse(res, SSE_EVENTS.completed, {
        data: {
          conversation: updatedConversation,
          message: assistantMessage,
        },
      });

      logger.info("Conversation creation completed successfully", {
        conversationId: conversation.id,
        modelUrl,
      });
      res.end();
    } catch (error: any) {
      logger.error("Error creating conversation", {
        error: error.message,
        stack: error.stack,
      });
      writeSse(res, SSE_EVENTS.error, {
        error: error.message || "Failed to create conversation",
      });
      res.end();
    }
  }

  async addMessage(req: Request, res: Response): Promise<void> {
    const { id: conversationId } = req.params;
    const { prompt, format = "stl" } = req.body as AddMessageRequest;
    logger.info("Adding message to conversation", {
      conversationId,
      promptLength: prompt?.length,
      format,
    });

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      logger.warn("Invalid prompt provided for message", { conversationId });
      res.status(400).json({
        success: false,
        error: "Prompt is required and must be a non-empty string",
      });
      return;
    }

    if (prompt.length > 1000) {
      logger.warn("Prompt too long", {
        conversationId,
        promptLength: prompt.length,
      });
      res.status(400).json({
        success: false,
        error: "Prompt is too long (maximum 1000 characters)",
      });
      return;
    }

    if (format !== "stl" && format !== "3mf") {
      logger.warn("Invalid format specified", { conversationId, format });
      res.status(400).json({
        success: false,
        error: 'Format must be either "stl" or "3mf"',
      });
      return;
    }

    // Check conversation exists
    const conversation = await this.conversationService.getConversation(
      conversationId
    );
    if (!conversation) {
      logger.warn("Conversation not found for message", { conversationId });
      res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
      return;
    }

    // Set up SSE
    setSseHeaders(res);
    logger.debug("SSE connection established for adding message", {
      conversationId,
    });

    try {
      // Add user message
      await this.conversationService.addUserMessage(conversationId, prompt);
      logger.debug("User message added", { conversationId });

      writeSse(res, SSE_EVENTS.generationStart, {
        message: "Generating OpenSCAD code...",
      });

      // Get all messages for context
      const messages = await this.conversationService.getConversationMessages(
        conversationId
      );
      logger.debug("Retrieved conversation history for AI context", {
        conversationId,
        messageCount: messages.length,
      });

      // Generate code with event-based streaming (includes conversation history)
      logger.info("Starting OpenSCAD code generation with history", {
        conversationId,
        messageCount: messages.length,
      });

      let scadCode = "";
      let chunkCount = 0;

      scadCode = await this.openScadAiService.generateCode(
        messages,
        (event: OpenScadStreamEvent) => {
          if (event.type === "code_delta") {
            chunkCount++;
          }
          writeAiStreamEvent(res, event);
        }
      );

      logger.info("Code generation completed", {
        conversationId,
        codeLength: scadCode.length,
        chunkCount,
      });

      // Save SCAD file
      const { id: fileId, filePath: scadPath } =
        await this.fileStorage.saveScadFile(scadCode);
      logger.debug("SCAD file saved", { conversationId, fileId, scadPath });

      writeSse(res, SSE_EVENTS.compiling, {
        message: "Compiling with OpenSCAD...",
      });

      // Generate 3D model
      logger.info("Compiling 3D model", { conversationId, format, fileId });
      const outputPath = this.fileStorage.getOutputPath(fileId, format);
      if (format === "stl") {
        await this.openscadService.generateSTL(scadPath, outputPath);
      } else {
        await this.openscadService.generate3MF(scadPath, outputPath);
      }
      logger.info("3D model compiled successfully", {
        conversationId,
        format,
        outputPath,
      });

      const modelUrl = `/api/models/${fileId}/${format}`;

      // Save assistant message
      const assistantMessage =
        await this.conversationService.addAssistantMessage(
          conversationId,
          `Updated model for: ${prompt}`,
          scadCode,
          modelUrl,
          format
        );
      logger.debug("Assistant message saved", {
        conversationId,
        messageId: assistantMessage.id,
      });

      // Get updated conversation
      const updatedConversation =
        await this.conversationService.getConversation(conversationId);

      writeSse(res, SSE_EVENTS.completed, {
        data: {
          conversation: updatedConversation,
          message: assistantMessage,
        },
      });

      logger.info("Message added successfully", {
        conversationId,
        modelUrl,
      });
      res.end();
    } catch (error: any) {
      logger.error("Error adding message to conversation", {
        conversationId,
        error: error.message,
        stack: error.stack,
      });
      writeSse(res, SSE_EVENTS.error, {
        error: error.message || "Failed to add message",
      });
      res.end();
    }
  }

  async deleteConversation(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    logger.info("Deleting conversation", { conversationId: id });

    try {
      const conversation = await this.conversationService.getConversation(id);
      if (!conversation) {
        logger.warn("Conversation not found for deletion", {
          conversationId: id,
        });
        res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
        return;
      }

      await this.conversationService.deleteConversation(id);
      logger.info("Conversation deleted successfully", { conversationId: id });

      res.json({
        success: true,
        message: "Conversation deleted",
      });
    } catch (error: any) {
      logger.error("Error deleting conversation", {
        conversationId: id,
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete conversation",
      });
    }
  }
}
