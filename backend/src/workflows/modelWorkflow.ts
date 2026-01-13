import { Response } from "express";
import { OpenScadAiService } from "../services/openScadAiService";
import { OpenSCADService } from "../services/openscadService";
import { FileStorageService } from "../services/fileStorageService";
import { ConversationService } from "../services/conversationService";
import { logger } from "../infrastructure/logger/logger";
import { SSE_EVENTS, writeAiStreamEvent, writeSse } from "../utils/sseUtils";
import { CodeGenerationAgent } from "../agents/codeGenerationAgent";
import { RetryFeedbackAgent } from "../agents/retryFeedbackAgent";
import { CompilationAgent } from "../agents/compilationAgent";
import { AiClient } from "../clients/aiClient";
import { GenerationRetryRunner } from "../runners/generationRetryRunner";

export class ModelWorkflow {
  private codeGenerationAgent: CodeGenerationAgent;
  private retryFeedbackAgent: RetryFeedbackAgent;
  private compilationAgent: CompilationAgent;
  private generationRetryRunner: GenerationRetryRunner;
  constructor(
    private conversationService: ConversationService,
    private openScadAiService: OpenScadAiService,
    private openscadService: OpenSCADService,
    private fileStorage: FileStorageService,
    private aiClient: AiClient
  ) {
    logger.debug("ModelWorkflow initialized");
    this.codeGenerationAgent = new CodeGenerationAgent(this.openScadAiService);
    this.retryFeedbackAgent = new RetryFeedbackAgent(this.conversationService);
    this.compilationAgent = new CompilationAgent(
      this.openscadService,
      this.fileStorage,
      this.aiClient
    );
    this.generationRetryRunner = new GenerationRetryRunner(
      this.conversationService,
      this.codeGenerationAgent,
      this.compilationAgent,
      this.retryFeedbackAgent,
      this.openscadService
    );
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
    const result = await this.generationRetryRunner.run(
      conversationId,
      prompt,
      format,
      {
        onAttemptStart: (attempt, maxAttempts, lastFailure) => {
          if (attempt === 1) {
            writeSse(res, SSE_EVENTS.generationStart, {
              message: "Generating OpenSCAD code...",
            });
            return;
          }

          if (lastFailure?.type === "validation") {
            writeSse(res, SSE_EVENTS.generationStart, {
              message: `Preview validation failed, retrying (${attempt}/${maxAttempts})...`,
            });
            return;
          }

          writeSse(res, SSE_EVENTS.generationStart, {
            message: `Compile failed, retrying (${attempt}/${maxAttempts})...`,
          });
        },
        onCompiling: () => {
          writeSse(res, SSE_EVENTS.compiling, {
            message: "Compiling with OpenSCAD...",
          });
        },
        onValidating: (previewUrl) => {
          writeSse(res, SSE_EVENTS.validating, {
            message: "Validating preview...",
            previewUrl,
          });
        },
        onStreamEvent: (event) => {
          writeAiStreamEvent(res, event);
        },
      }
    );

    logger.info("3D model compiled successfully", {
      conversationId,
      format,
      outputPath: result.outputPath,
    });

    const assistantMessage = await this.conversationService.addAssistantMessage(
      conversationId,
      isNewConversation
        ? `Generated model for: ${prompt}`
        : `Updated model for: ${prompt}`,
      result.scadCode,
      result.modelUrl,
      format,
      result.previewUrl
    );
    logger.debug("Assistant message saved", {
      conversationId,
      messageId: assistantMessage.id,
    });

    const updatedConversation = await this.conversationService.getConversation(
      conversationId
    );

    writeSse(res, SSE_EVENTS.completed, {
      data: {
        conversation: updatedConversation,
        message: assistantMessage,
      },
    });

    logger.info("Model generation completed successfully", {
      conversationId,
      modelUrl: result.modelUrl,
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
