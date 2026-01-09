import { Request, Response } from "express";
import { ConversationService } from "../services/conversationService";
import { OpenAIService } from "../services/openaiService";
import { OpenSCADService } from "../services/openscadService";
import { FileStorageService } from "../services/fileStorageService";
import {
  CreateConversationRequest,
  AddMessageRequest,
} from "../../../shared/src/types/model";

export class ConversationController {
  constructor(
    private conversationService: ConversationService,
    private openaiService: OpenAIService,
    private openscadService: OpenSCADService,
    private fileStorage: FileStorageService
  ) {}

  async listConversations(req: Request, res: Response): Promise<void> {
    try {
      const conversations = await this.conversationService.listConversations();
      res.json({
        success: true,
        data: conversations,
      });
    } catch (error: any) {
      console.error("Error listing conversations:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list conversations",
      });
    }
  }

  async getConversation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const conversation = await this.conversationService.getConversation(id);

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
        return;
      }

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error: any) {
      console.error("Error getting conversation:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get conversation",
      });
    }
  }

  async createConversation(req: Request, res: Response): Promise<void> {
    const { prompt, format = "stl" } = req.body as CreateConversationRequest;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: "Prompt is required and must be a non-empty string",
      });
      return;
    }

    if (prompt.length > 1000) {
      res.status(400).json({
        success: false,
        error: "Prompt is too long (maximum 1000 characters)",
      });
      return;
    }

    if (format !== "stl" && format !== "3mf") {
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

    try {
      // Create the conversation
      const conversation = await this.conversationService.createConversation();

      res.write(
        `data: ${JSON.stringify({
          type: "conversation_created",
          conversationId: conversation.id,
        })}\n\n`
      );

      // Add user message
      await this.conversationService.addUserMessage(conversation.id, prompt);

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

      // Generate code with streaming
      let scadCode = "";
      for await (const chunk of this.openaiService.generateOpenSCADCodeStreamWithHistory(
        messages
      )) {
        scadCode += chunk;
        res.write(`data: ${JSON.stringify({ type: "code_chunk", chunk })}\n\n`);
      }

      scadCode = this.openaiService.cleanCode(scadCode);
      res.write(
        `data: ${JSON.stringify({ type: "code_complete", code: scadCode })}\n\n`
      );

      // Save SCAD file
      const { id: fileId, filePath: scadPath } =
        await this.fileStorage.saveScadFile(scadCode);

      res.write(
        `data: ${JSON.stringify({
          type: "compiling",
          message: "Compiling with OpenSCAD...",
        })}\n\n`
      );

      // Generate 3D model
      const outputPath = this.fileStorage.getOutputPath(fileId, format);
      if (format === "stl") {
        await this.openscadService.generateSTL(scadPath, outputPath);
      } else {
        await this.openscadService.generate3MF(scadPath, outputPath);
      }

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

      res.end();
    } catch (error: any) {
      console.error("Error creating conversation:", error);
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

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: "Prompt is required and must be a non-empty string",
      });
      return;
    }

    if (prompt.length > 1000) {
      res.status(400).json({
        success: false,
        error: "Prompt is too long (maximum 1000 characters)",
      });
      return;
    }

    if (format !== "stl" && format !== "3mf") {
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

    try {
      // Add user message
      await this.conversationService.addUserMessage(conversationId, prompt);

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

      // Generate code with streaming (includes conversation history)
      let scadCode = "";
      for await (const chunk of this.openaiService.generateOpenSCADCodeStreamWithHistory(
        messages
      )) {
        scadCode += chunk;
        res.write(`data: ${JSON.stringify({ type: "code_chunk", chunk })}\n\n`);
      }

      scadCode = this.openaiService.cleanCode(scadCode);
      res.write(
        `data: ${JSON.stringify({ type: "code_complete", code: scadCode })}\n\n`
      );

      // Save SCAD file
      const { id: fileId, filePath: scadPath } =
        await this.fileStorage.saveScadFile(scadCode);

      res.write(
        `data: ${JSON.stringify({
          type: "compiling",
          message: "Compiling with OpenSCAD...",
        })}\n\n`
      );

      // Generate 3D model
      const outputPath = this.fileStorage.getOutputPath(fileId, format);
      if (format === "stl") {
        await this.openscadService.generateSTL(scadPath, outputPath);
      } else {
        await this.openscadService.generate3MF(scadPath, outputPath);
      }

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

      res.end();
    } catch (error: any) {
      console.error("Error adding message:", error);
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
    try {
      const { id } = req.params;

      const conversation = await this.conversationService.getConversation(id);
      if (!conversation) {
        res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
        return;
      }

      await this.conversationService.deleteConversation(id);

      res.json({
        success: true,
        message: "Conversation deleted",
      });
    } catch (error: any) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete conversation",
      });
    }
  }
}
