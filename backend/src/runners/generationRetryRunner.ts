import { OpenScadStreamEvent } from "../services/openScadAiService";
import { OpenSCADService } from "../services/openscadService";
import { ConversationService } from "../services/conversationService";
import { CompilationAgent, VisionCheckError } from "../agents/compilationAgent";
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
  onValidating: (previewUrl: string) => void;
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
    previewUrl: string;
  }> {
    const maxAttempts = Math.max(1, config.openscad.maxCompileRetries);
    let lastCompiled:
      | {
          scadCode: string;
          modelUrl: string;
          outputPath: string;
          fileId: string;
          previewUrl: string;
          validation: { status: "ok" | "update"; reason?: string };
        }
      | null = null;
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
        const result = await this.compilationAgent.compileModel({
            scadCode,
            format,
            prompt,
            validate: true,
            onValidationStart: callbacks.onValidating,
          });
        return {
          scadCode,
          modelUrl: result.modelUrl,
          outputPath: result.outputPath,
          fileId: result.fileId,
          previewUrl: result.previewUrl,
        };
      } catch (error: any) {
        if (error instanceof VisionCheckError) {
          logger.warn("Visual QA requested update", {
            conversationId,
            attempt,
            reason: error.message,
          });

          lastCompiled = {
            scadCode,
            modelUrl: error.compiled.modelUrl,
            outputPath: error.compiled.outputPath,
            fileId: error.compiled.fileId,
            previewUrl: error.previewUrl,
            validation: { status: "update", reason: error.message },
          };

          await this.retryFeedbackAgent.recordFailure(
            "validation",
            conversationId,
            scadCode,
            format,
            error.message,
            error.previewUrl
          );
          lastFailure = { type: "validation", message: error.message };

          if (attempt === maxAttempts) {
            return {
              scadCode: lastCompiled.scadCode,
              modelUrl: lastCompiled.modelUrl,
              outputPath: lastCompiled.outputPath,
              fileId: lastCompiled.fileId,
              previewUrl: lastCompiled.previewUrl,
            };
          }
          continue;
        }

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
          if (lastCompiled) {
            return {
              scadCode: lastCompiled.scadCode,
              modelUrl: lastCompiled.modelUrl,
              outputPath: lastCompiled.outputPath,
              fileId: lastCompiled.fileId,
              previewUrl: lastCompiled.previewUrl,
            };
          }
          throw new Error(
            `Failed to generate model after ${maxAttempts} attempts: ${parsed.message}`
          );
        }
      }
    }

    throw new Error("Model generation failed unexpectedly");
  }
}
