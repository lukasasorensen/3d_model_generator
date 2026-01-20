import { Response } from "express";
import { OpenSCADService } from "../../services/openscadService";
import { FileStorageService } from "../../services/fileStorageService";
import { ConversationService } from "../../services/conversationService";
import { logger } from "../../infrastructure/logger/logger";
import { SSE_EVENTS, writeSse } from "../../utils/sseUtils";
import { AiClient } from "../../clients/aiClient";
import { FinalizeModelWorkflow } from "./finalizeModelWorkflow";
import { OpenScadAiService } from "../../services/openScadAiService";

export class PreviewRejectionModelWorkflow extends FinalizeModelWorkflow {
  constructor(
    conversationService: ConversationService,
    openScadAiService: OpenScadAiService,
    openscadService: OpenSCADService,
    fileStorage: FileStorageService,
    aiClient: AiClient
  ) {
    super(conversationService, openScadAiService, openscadService, fileStorage, aiClient);
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
      await this.generateAndCompileWithRetry(res, conversationId, originalPrompt, format, false);
    }
  }
}
