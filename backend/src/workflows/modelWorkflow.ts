import { Response } from "express";
import {
  OpenScadAiService,
  OpenScadStreamEvent,
} from "../services/openScadAiService";
import { OpenSCADService } from "../services/openscadService";
import { FileStorageService } from "../services/fileStorageService";
import { ConversationService } from "../services/conversationService";
import { logger } from "../infrastructure/logger/logger";
import {
  SSE_EVENTS,
  writeAiStreamEvent,
  writeSse,
} from "../utils/sseUtils";

export class ModelWorkflow {
  constructor(
    private conversationService: ConversationService,
    private openScadAiService: OpenScadAiService,
    private openscadService: OpenSCADService,
    private fileStorage: FileStorageService
  ) {
    logger.debug("ModelWorkflow initialized");
  }

  async generateModelStream(
    res: Response,
    prompt: string,
    format: "stl" | "3mf",
    conversationId?: string
  ): Promise<void> {
    if (conversationId) {
      await this.generateWithConversation(res, prompt, format, conversationId);
    } else {
      await this.createConversationAndGenerate(res, prompt, format);
    }
  }

  async getConversation(conversationId: string) {
    return this.conversationService.getConversation(conversationId);
  }

  private async createConversationAndGenerate(
    res: Response,
    prompt: string,
    format: "stl" | "3mf"
  ): Promise<void> {
    logger.info("Creating conversation and generating model (streaming)", {
      promptLength: prompt.length,
      format,
    });

    const conversation = await this.conversationService.createConversation();
    logger.info("Conversation created", { conversationId: conversation.id });

    writeSse(res, SSE_EVENTS.conversationCreated, {
      conversationId: conversation.id,
    });

    await this.conversationService.addUserMessage(conversation.id, prompt);
    logger.debug("User message added to conversation", {
      conversationId: conversation.id,
    });

    await this.generateAndCompile(res, conversation.id, prompt, format, true);
  }

  private async generateWithConversation(
    res: Response,
    prompt: string,
    format: "stl" | "3mf",
    conversationId: string
  ): Promise<void> {
    logger.info("Updating model from conversation (streaming)", {
      conversationId,
      promptLength: prompt.length,
      format,
    });

    await this.conversationService.addUserMessage(conversationId, prompt);
    logger.debug("User message added", { conversationId });

    await this.generateAndCompile(res, conversationId, prompt, format, false);
  }

  private async generateAndCompile(
    res: Response,
    conversationId: string,
    prompt: string,
    format: "stl" | "3mf",
    isNewConversation: boolean
  ): Promise<void> {
    writeSse(res, SSE_EVENTS.generationStart, {
      message: "Generating OpenSCAD code...",
    });

    const messages = await this.conversationService.getConversationMessages(
      conversationId
    );
    logger.debug("Retrieved conversation messages for AI context", {
      conversationId,
      messageCount: messages.length,
    });

    let chunkCount = 0;
    const scadCode = await this.openScadAiService.generateCode(
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

    const { id: fileId, filePath: scadPath } =
      await this.fileStorage.saveScadFile(scadCode);
    logger.debug("SCAD file saved", { conversationId, fileId, scadPath });

    writeSse(res, SSE_EVENTS.compiling, {
      message: "Compiling with OpenSCAD...",
    });

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
    const assistantMessage = await this.conversationService.addAssistantMessage(
      conversationId,
      isNewConversation
        ? `Generated model for: ${prompt}`
        : `Updated model for: ${prompt}`,
      scadCode,
      modelUrl,
      format
    );
    logger.debug("Assistant message saved", {
      conversationId,
      messageId: assistantMessage.id,
    });

    const updatedConversation =
      await this.conversationService.getConversation(conversationId);

    writeSse(res, SSE_EVENTS.completed, {
      data: {
        conversation: updatedConversation,
        message: assistantMessage,
      },
    });

    logger.info("Model generation completed successfully", {
      conversationId,
      modelUrl,
    });
  }

  async getModelFile(
    id: string,
    format: "stl" | "3mf"
  ): Promise<{ filePath: string } | null> {
    logger.info("Retrieving model file", { fileId: id, format });

    const filePath = this.fileStorage.getOutputPath(id, format);
    const exists = await this.fileStorage.fileExists(filePath);

    if (!exists) {
      logger.warn("Model file not found", { fileId: id, format, filePath });
      return null;
    }

    logger.info("Sending model file", { fileId: id, format, filePath });
    return { filePath };
  }
}
