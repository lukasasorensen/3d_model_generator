import { Response } from "express";
import { OpenScadAiService, OpenScadStreamEvent } from "../services/openScadAiService";
import { OpenSCADService } from "../services/openscadService";
import { FileStorageService } from "../services/fileStorageService";
import { ConversationService } from "../services/conversationService";
import { logger } from "../infrastructure/logger/logger";
import { SSE_EVENTS, writeAiStreamEvent, writeSse } from "../utils/sseUtils";
import { CodeGenerationAgent } from "../agents/codeGenerationAgent";
import { RetryFeedbackAgent } from "../agents/retryFeedbackAgent";
import { CompilationAgent } from "../agents/compilationAgent";
import { AiClient } from "../clients/aiClient";
import { RetryRunner } from "../runners/retryRunner";
import { config } from "../config/config";

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
  private codeGenerationAgent: CodeGenerationAgent;
  private retryFeedbackAgent: RetryFeedbackAgent;
  private compilationAgent: CompilationAgent;
  private retryRunner: RetryRunner;

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

    const result = await this.retryRunner.run<PreviewResult, GenerationFailure>(
      async (context) => {
        // Notify attempt start
        this.handleAttemptStart(res, context.attempt, context.maxAttempts, context.lastFailure);

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
          attempt: context.attempt,
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
            attempt: context.attempt,
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

  private handleAttemptStart(
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

  async finalizeModelStream(
    res: Response,
    conversationId: string,
    format: "stl" | "3mf"
  ): Promise<void> {
    const conversation = await this.conversationService.getConversation(
      conversationId
    );
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const lastAssistant = [...conversation.messages]
      .reverse()
      .find((msg) => msg.role === "assistant" && msg.scadCode);

    if (!lastAssistant?.scadCode) {
      throw new Error("No generated code available to finalize");
    }

    const { id: fileId, filePath: scadPath } =
      await this.fileStorage.saveScadFile(lastAssistant.scadCode);

    writeSse(res, SSE_EVENTS.outputting, {
      message: "Generating final model...",
    });

    const output = await this.openscadService.generateOutput(
      scadPath,
      fileId,
      format
    );

    const assistantMessage = await this.conversationService.addAssistantMessage(
      conversationId,
      "Generated final model.",
      lastAssistant.scadCode,
      output.modelUrl,
      format,
      lastAssistant.previewUrl
    );

    const updatedConversation = await this.conversationService.getConversation(
      conversationId
    );

    writeSse(res, SSE_EVENTS.completed, {
      data: {
        conversation: updatedConversation,
        message: assistantMessage,
      },
    });
  }

  async validateAndRetryStream(
    res: Response,
    conversationId: string,
    format: "stl" | "3mf"
  ): Promise<void> {
    const conversation = await this.conversationService.getConversation(
      conversationId
    );
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Find the last assistant message with a preview but no model URL (pending approval)
    const lastAssistant = [...conversation.messages]
      .reverse()
      .find((msg) => msg.role === "assistant" && msg.scadCode && msg.previewUrl && !msg.modelUrl);

    if (!lastAssistant?.scadCode || !lastAssistant?.previewUrl) {
      throw new Error("No pending preview available to validate");
    }

    // Get the original user prompt for validation context
    const userMessages = conversation.messages.filter((msg) => msg.role === "user");
    const originalPrompt = userMessages[userMessages.length - 1]?.content || "";

    // Get the preview file path
    const previewFileId = lastAssistant.previewUrl.split("/").pop()?.replace(".png", "");
    if (!previewFileId) {
      throw new Error("Could not determine preview file ID");
    }
    const previewPath = this.fileStorage.getPreviewPath(previewFileId);

    writeSse(res, SSE_EVENTS.validating, {
      message: "Validating preview with AI...",
      previewUrl: lastAssistant.previewUrl,
    });

    try {
      // Run AI vision validation
      await this.compilationAgent.validatePreview(
        originalPrompt,
        previewPath,
        lastAssistant.previewUrl,
        {
          fileId: previewFileId,
          previewPath,
          scadPath: this.fileStorage.getScadPath(previewFileId),
        }
      );

      // Validation passed - proceed to finalize
      logger.info("AI validation passed", { conversationId });
      await this.finalizeModelStream(res, conversationId, format);
    } catch (error: any) {
      // Validation failed - record feedback and regenerate
      logger.warn("AI validation failed", {
        conversationId,
        reason: error.message,
      });

      writeSse(res, SSE_EVENTS.validationFailed, {
        message: "AI validation found issues.",
        reason: error.message,
        previewUrl: lastAssistant.previewUrl,
      });

      // Record the validation failure
      await this.retryFeedbackAgent.recordFailure(
        "validation",
        conversationId,
        lastAssistant.scadCode,
        format,
        error.message,
        lastAssistant.previewUrl
      );

      // Regenerate code with feedback
      await this.generateAndCompile(res, conversationId, originalPrompt, format, false);
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
