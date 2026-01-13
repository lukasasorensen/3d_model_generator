import { OpenScadStreamEvent } from "../services/openScadAiService";
import { OpenSCADService } from "../services/openscadService";
import { ConversationService } from "../services/conversationService";
import { CompilationAgent, VisionCheckError } from "../agents/compilationAgent";
import { CodeGenerationAgent } from "../agents/codeGenerationAgent";
import { RetryFeedbackAgent } from "../agents/retryFeedbackAgent";
import { config } from "../config/config";
import { logger } from "../infrastructure/logger/logger";

interface GenerationAttemptCallbacks {
  onAttemptStart: (attempt: number, maxAttempts: number) => void;
  onCompiling: () => void;
  onStreamEvent: (event: OpenScadStreamEvent) => void;
}

export class GenerationRetryRunner {
  constructor(
    private conversationService: ConversationService,
    private codeGenerationAgent: CodeGenerationAgent,
    private compilationAgent: CompilationAgent,
    private retryFeedbackAgent: RetryFeedbackAgent,
    private openscadService: OpenSCADService
  ) {}

  async run(
    conversationId: string,
    prompt: string,
    format: "stl" | "3mf",
    callbacks: GenerationAttemptCallbacks
  ): Promise<{
    scadCode: string;
    modelUrl: string;
    outputPath: string;
    fileId: string;
  }> {
    const maxAttempts = Math.max(1, config.openscad.maxCompileRetries);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      callbacks.onAttemptStart(attempt, maxAttempts);

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
        const { fileId, outputPath, modelUrl } =
          await this.compilationAgent.compileModel({
            scadCode,
            format,
            prompt,
            validate: true,
          });
        return { scadCode, modelUrl, outputPath, fileId };
      } catch (error: any) {
        let errorMessage: string;

        if (error instanceof VisionCheckError) {
          logger.warn("Visual QA failed for model", {
            conversationId,
            attempt,
            error: error.message,
          });
          errorMessage = `Visual QA failed: ${error.message}`;
        } else {
          const rawMessage = error?.message || "OpenSCAD compilation error";
          const parsed = this.openscadService.parseError(rawMessage);
          logger.warn("OpenSCAD compilation failed", {
            conversationId,
            attempt,
            error: rawMessage,
          });
          errorMessage = parsed.message;
        }

        await this.retryFeedbackAgent.recordFailure(
          this.getErrorType(error),
          conversationId,
          scadCode,
          format,
          errorMessage
        );

        if (attempt === maxAttempts) {
          throw new Error(
            `Failed to generate model after ${maxAttempts} attempts: ${errorMessage}`
          );
        }
      }
    }

    throw new Error("Model generation failed unexpectedly");
  }

  private getErrorType(error: Error): "validation" | "compilation" {
    if (error instanceof VisionCheckError) {
      return "validation";
    } else {
      return "compilation";
    }
  }
}
