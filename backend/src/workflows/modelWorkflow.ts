import { Response } from "express";
import {
  OpenScadAiService,
  OpenScadStreamEvent,
} from "../services/openScadAiService";
import { OpenSCADService } from "../services/openscadService";
import { FileStorageService } from "../services/fileStorageService";
import { ConversationService } from "../services/conversationService";
import { logger } from "../infrastructure/logger/logger";
import { SSE_EVENTS, writeAiStreamEvent, writeSse } from "../utils/sseUtils";
import { config } from "../config/config";
import { CodeGenerationAgent } from "./agents/codeGenerationAgent";
import { RetryFeedbackAgent } from "./agents/retryFeedbackAgent";
import { AiClient } from "../clients/aiClient";
import { CompilationAgent } from "./agents/compilationAgent";

export class ModelWorkflow {
  private codeGenerationAgent: CodeGenerationAgent;
  private retryFeedbackAgent: RetryFeedbackAgent;
  constructor(
    private conversationService: ConversationService,
    private openScadAiService: OpenScadAiService,
    private openscadService: OpenSCADService,
    private fileStorage: FileStorageService,
    private aiCompilationAgent: CompilationAgent,
    private aiClient: AiClient
  ) {
    logger.debug("ModelWorkflow initialized");
    this.codeGenerationAgent = new CodeGenerationAgent(
      this.openScadAiService,
      this.aiClient
    );
    this.retryFeedbackAgent = new RetryFeedbackAgent(this.conversationService);
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
    const maxAttempts = Math.max(1, config.openscad.maxCompileRetries);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt === 1) {
        writeSse(res, SSE_EVENTS.generationStart, {
          message: "Generating OpenSCAD code...",
        });
      } else {
        writeSse(res, SSE_EVENTS.generationStart, {
          message: `Compile failed, retrying (${attempt}/${maxAttempts})...`,
        });
      }

      const messages = await this.conversationService.getConversationMessages(
        conversationId
      );
      logger.debug("Retrieved conversation messages for AI context", {
        conversationId,
        messageCount: messages.length,
      });

      let chunkCount = 0;
      const scadCode = await this.codeGenerationAgent.generateCode(
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
        attempt,
      });

      writeSse(res, SSE_EVENTS.compiling, {
        message: "Compiling with OpenSCAD...",
      });

      try {
        const { fileId, outputPath, modelUrl } =
          await this.aiCompilationAgent.compileModel(scadCode, format);

        logger.info("3D model compiled successfully", {
          conversationId,
          format,
          outputPath,
          attempt,
        });

        const assistantMessage =
          await this.conversationService.addAssistantMessage(
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
        return;
      } catch (error: any) {
        const rawMessage = error?.message || "OpenSCAD compilation error";
        const parsed = this.openscadService.parseError(rawMessage);
        logger.warn("OpenSCAD compilation failed", {
          conversationId,
          attempt,
          error: rawMessage,
        });

        await this.retryFeedbackAgent.recordFailure(
          conversationId,
          scadCode,
          format,
          parsed.message
        );

        if (attempt === maxAttempts) {
          throw new Error(
            `Failed to compile OpenSCAD after ${maxAttempts} attempts: ${parsed.message}`
          );
        }
      }
    }
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
