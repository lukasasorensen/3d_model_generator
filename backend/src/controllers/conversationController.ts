import { Request, Response } from "express";
import { ConversationService } from "../services/conversationService";
import { OpenAIService } from "../services/openaiService";
import { OpenSCADService } from "../services/openscadService";
import { FileStorageService } from "../services/fileStorageService";
import {
  CreateConversationRequest,
  AddMessageRequest,
} from "../../../shared/src/types/model";
import { logger } from "../infrastructure/logger/logger";

export class ConversationController {
  constructor(
    private conversationService: ConversationService,
    private openaiService: OpenAIService,
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
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    logger.debug("SSE connection established for conversation creation");

    try {
      // Create the conversation
      const conversation = await this.conversationService.createConversation();
      logger.info("Conversation created", { conversationId: conversation.id });

      res.write(
        `data: ${JSON.stringify({
          type: "conversation_created",
          conversationId: conversation.id,
        })}\n\n`
      );

      // Add user message
      await this.conversationService.addUserMessage(conversation.id, prompt);
      logger.debug("User message added to conversation", {
        conversationId: conversation.id,
      });

      res.write(
        `data: ${JSON.stringify({
          type: "start",
          message: "Generating OpenSCAD code...",
        })}\n\n`
      );

      // Get messages for context
      const messages = await this.conversationService.getConversationMessages(
        conversation.id
      );
      logger.debug("Retrieved conversation messages for AI context", {
        conversationId: conversation.id,
        messageCount: messages.length,
      });

      // Generate code with streaming
      logger.info("Starting OpenSCAD code generation", {
        conversationId: conversation.id,
      });
      let scadCode = "";
      let chunkCount = 0;
      for await (const chunk of this.openaiService.generateOpenSCADCodeStreamWithHistory(
        messages
      )) {
        scadCode += chunk;
        chunkCount++;
        res.write(`data: ${JSON.stringify({ type: "code_chunk", chunk })}\n\n`);
      }
      logger.info("Code generation completed", {
        conversationId: conversation.id,
        codeLength: scadCode.length,
        chunkCount,
      });

      scadCode = this.openaiService.cleanCode(scadCode);
      res.write(
        `data: ${JSON.stringify({ type: "code_complete", code: scadCode })}\n\n`
      );

      // Save SCAD file
      const { id: fileId, filePath: scadPath } =
        await this.fileStorage.saveScadFile(scadCode);
      logger.debug("SCAD file saved", { fileId, scadPath });

      res.write(
        `data: ${JSON.stringify({
          type: "compiling",
          message: "Compiling with OpenSCAD...",
        })}\n\n`
      );

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

      res.write(
        `data: ${JSON.stringify({
          type: "completed",
          data: {
            conversation: updatedConversation,
            message: assistantMessage,
          },
        })}\n\n`
      );

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
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: error.message || "Failed to create conversation",
        })}\n\n`
      );
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
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    logger.debug("SSE connection established for adding message", {
      conversationId,
    });

    try {
      // Add user message
      await this.conversationService.addUserMessage(conversationId, prompt);
      logger.debug("User message added", { conversationId });

      res.write(
        `data: ${JSON.stringify({
          type: "start",
          message: "Generating OpenSCAD code...",
        })}\n\n`
      );

      // Get all messages for context
      const messages = await this.conversationService.getConversationMessages(
        conversationId
      );
      logger.debug("Retrieved conversation history for AI context", {
        conversationId,
        messageCount: messages.length,
      });

      // Generate code with streaming (includes conversation history)
      logger.info("Starting OpenSCAD code generation with history", {
        conversationId,
        messageCount: messages.length,
      });
      let scadCode = "";
      let chunkCount = 0;
      for await (const chunk of this.openaiService.generateOpenSCADCodeStreamWithHistory(
        messages
      )) {
        scadCode += chunk;
        chunkCount++;
        res.write(`data: ${JSON.stringify({ type: "code_chunk", chunk })}\n\n`);
      }
      logger.info("Code generation completed", {
        conversationId,
        codeLength: scadCode.length,
        chunkCount,
      });

      scadCode = this.openaiService.cleanCode(scadCode);
      res.write(
        `data: ${JSON.stringify({ type: "code_complete", code: scadCode })}\n\n`
      );

      // Save SCAD file
      const { id: fileId, filePath: scadPath } =
        await this.fileStorage.saveScadFile(scadCode);
      logger.debug("SCAD file saved", { conversationId, fileId, scadPath });

      res.write(
        `data: ${JSON.stringify({
          type: "compiling",
          message: "Compiling with OpenSCAD...",
        })}\n\n`
      );

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

      res.write(
        `data: ${JSON.stringify({
          type: "completed",
          data: {
            conversation: updatedConversation,
            message: assistantMessage,
          },
        })}\n\n`
      );

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
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: error.message || "Failed to add message",
        })}\n\n`
      );
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
