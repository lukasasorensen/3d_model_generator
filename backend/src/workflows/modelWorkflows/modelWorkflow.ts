import { Response } from "express";
import { OpenScadAiService, OpenScadStreamEvent } from "../../services/openScadAiService";
import { OpenSCADService } from "../../services/openscadService";
import { FileStorageService } from "../../services/fileStorageService";
import { ConversationService } from "../../services/conversationService";
import { logger } from "../../infrastructure/logger/logger";
import { SSE_EVENTS, writeAiStreamEvent, writeSse } from "../../utils/sseUtils";
import { CodeGenerationAgent } from "../../agents/codeGenerationAgent";
import { RetryFeedbackAgent } from "../../agents/retryFeedbackAgent";
import { CompilationAgent } from "../../agents/compilationAgent";
import { AiClient } from "../../clients/aiClient";
import { RetryRunner } from "../../runners/retryRunner";
import { config } from "../../config/config";

interface GenerationFailure {
  type: "validation" | "compilation";
  message: string;
}

interface PreviewResult {
  scadCode: string;
  fileId: string;
  previewUrl: string;
  scadPath: string;
  previewPath: string;
}

export class ModelWorkflow {
  protected codeGenerationAgent: CodeGenerationAgent;
  protected retryFeedbackAgent: RetryFeedbackAgent;
  protected compilationAgent: CompilationAgent;
  protected retryRunner: RetryRunner;

  constructor(
    protected conversationService: ConversationService,
    protected openScadAiService: OpenScadAiService,
    protected openscadService: OpenSCADService,
    protected fileStorage: FileStorageService,
    protected aiClient: AiClient
  ) {
    logger.debug("ModelWorkflow initialized");
    this.codeGenerationAgent = new CodeGenerationAgent(this.openScadAiService);
    this.retryFeedbackAgent = new RetryFeedbackAgent(this.conversationService);
    this.compilationAgent = new CompilationAgent(this.aiClient);
    this.retryRunner = new RetryRunner();
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

  protected async createConversationAndGenerate(
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

    await this.generateAndCompileWithRetry(res, conversation.id, prompt, format, true);
  }

  protected async generateWithConversation(
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

    await this.generateAndCompileWithRetry(res, conversationId, prompt, format, false);
  }

  protected async generateAndCompileWithRetry(
    res: Response,
    conversationId: string,
    prompt: string,
    format: "stl" | "3mf",
    isNewConversation: boolean
  ): Promise<void> {
    const maxAttempts = Math.max(1, config.openscad.maxCompileRetries);

    const result = await this.retryRunner.run<PreviewResult, GenerationFailure>(
      async (context) => {
        this.handleAttemptStart(res, context.attempt, context.maxAttempts, context.lastFailure);
        return this.generateAndCompile(res, conversationId, format);
      },
      { maxAttempts }
    );

    // Preview is ready - save to conversation for later finalization
    await this.conversationService.addAssistantMessage(
      conversationId,
      isNewConversation
        ? `Generated preview for: ${prompt}`
        : `Updated preview for: ${prompt}`,
      result.scadCode,
      undefined, // No model URL yet
      format,
      result.previewUrl
    );
    logger.info("Preview ready - awaiting user approval", {
      conversationId,
      previewUrl: result.previewUrl,
    });
  }

  protected async generateAndCompile(
    res: Response,
    conversationId: string,
    format: "stl" | "3mf",
  ): Promise<PreviewResult> {
    // Get conversation messages for AI context
    const messages = await this.conversationService.getConversationMessages(conversationId);
    logger.debug("Retrieved conversation messages for AI context", {
      conversationId,
      messageCount: messages.length,
    });

    // Generate code
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
    });

    // Compile preview
    writeSse(res, SSE_EVENTS.compiling, {
      message: "Rendering preview...",
    });

    try {
      const previewResult = await this.openscadService.previewModel({ scadCode });

      // Preview compiled successfully
      writeSse(res, SSE_EVENTS.previewReady, {
        message: "Preview ready - awaiting approval",
        previewUrl: previewResult.previewUrl,
        fileId: previewResult.fileId,
      });

      return {
        scadCode,
        fileId: previewResult.fileId,
        previewUrl: previewResult.previewUrl,
        scadPath: previewResult.scadPath,
        previewPath: previewResult.previewPath,
      };
    } catch (error: any) {
      const rawMessage = error?.message || "OpenSCAD compilation error";
      const parsed = this.openscadService.parseError(rawMessage);
      logger.warn("OpenSCAD compilation failed", {
        conversationId,
        error: rawMessage,
      });

      await this.retryFeedbackAgent.recordFailure(
        "compilation",
        conversationId,
        scadCode,
        format,
        parsed.message
      );

      const failure: GenerationFailure = { type: "compilation", message: parsed.message };
      throw failure;
    }
  }

  protected handleAttemptStart(
    res: Response,
    attempt: number,
    maxAttempts: number,
    lastFailure?: GenerationFailure
  ): void {
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
