import { OpenScadStreamEvent } from "../services/openScadAiService";
import { OpenSCADService } from "../services/openscadService";
import { ConversationService } from "../services/conversationService";
import { CompilationAgent } from "../agents/compilationAgent";
import { CodeGenerationAgent } from "../agents/codeGenerationAgent";
import { RetryFeedbackAgent } from "../agents/retryFeedbackAgent";
import { config } from "../config/config";
import { logger } from "../infrastructure/logger/logger";

interface GenerationAttemptCallbacks {
  onAttemptStart: (
    attempt: number,
    maxAttempts: number,
    lastFailure?: { type: "validation" | "compilation"; message: string }
  ) => void;
  onCompiling: () => void;
  onPreviewReady: (previewUrl: string, fileId: string) => void;
  onStreamEvent: (event: OpenScadStreamEvent) => void;
}

export interface PreviewReadyResult {
  status: "preview_ready";
  scadCode: string;
  fileId: string;
  previewUrl: string;
  scadPath: string;
  previewPath: string;
}

export type GenerationResult = PreviewReadyResult;

export class GenerationRetryRunner {
  constructor(
    private conversationService: ConversationService,
    private codeGenerationAgent: CodeGenerationAgent,
    private compilationAgent: CompilationAgent,
    private retryFeedbackAgent: RetryFeedbackAgent,
    private openscadService: OpenSCADService
  ) { }

  async run(
    conversationId: string,
    prompt: string,
    format: "stl" | "3mf",
    callbacks: GenerationAttemptCallbacks
  ): Promise<GenerationResult> {
    const maxAttempts = Math.max(1, config.openscad.maxCompileRetries);
    let lastFailure:
      | { type: "validation" | "compilation"; message: string }
      | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      callbacks.onAttemptStart(attempt, maxAttempts, lastFailure);

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
          callbacks.onStreamEvent(event);
        }
      );

      logger.info("Code generation completed", {
        conversationId,
        codeLength: scadCode.length,
        chunkCount,
        attempt,
      });

      callbacks.onCompiling();

      try {
        const result = await this.openscadService.previewModel({
          scadCode,
        });

        // Preview compiled successfully - notify and return result for user approval
        callbacks.onPreviewReady(result.previewUrl, result.fileId);

        return {
          status: "preview_ready",
          scadCode,
          fileId: result.fileId,
          previewUrl: result.previewUrl,
          scadPath: result.scadPath,
          previewPath: result.previewPath,
        };
      } catch (error: any) {
        const rawMessage = error?.message || "OpenSCAD compilation error";
        const parsed = this.openscadService.parseError(rawMessage);
        logger.warn("OpenSCAD compilation failed", {
          conversationId,
          attempt,
          error: rawMessage,
        });

        await this.retryFeedbackAgent.recordFailure(
          "compilation",
          conversationId,
          scadCode,
          format,
          parsed.message
        );
        lastFailure = { type: "compilation", message: parsed.message };

        if (attempt === maxAttempts) {
          throw new Error(
            `Failed to generate model after ${maxAttempts} attempts: ${parsed.message}`
          );
        }
      }
    }

    throw new Error("Model generation failed unexpectedly");
  }
}
