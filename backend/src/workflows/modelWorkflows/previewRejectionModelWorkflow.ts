import { Response } from "express";
import { OpenSCADService } from "../../services/openscadService";
import { FileStorageService } from "../../services/fileStorageService";
import { ConversationService } from "../../services/conversationService";
import { logger } from "../../infrastructure/logger/logger";
import { SSE_EVENTS, writeSse } from "../../utils/sseUtils";
import { AiClient } from "../../clients/aiClient";
import { FinalizeModelWorkflow } from "./finalizeModelWorkflow";

export class PreviewRejectionModelWorkflow extends FinalizeModelWorkflow {
  constructor(
    conversationService: ConversationService,
    openscadService: OpenSCADService,
    fileStorage: FileStorageService,
    aiClient: AiClient
  ) {
    super(conversationService, openscadService, fileStorage, aiClient);
  }

  async rejectAndRetryStream(
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
      throw new Error("No pending preview available to reject");
    }

    // Get the original user prompt for context
    const userMessages = conversation.messages.filter((msg) => msg.role === "user");
    const originalPrompt = userMessages[userMessages.length - 1]?.content || "";
    const mostRecentScadCode = lastAssistant.scadCode;

    // Get the preview file path
    const previewFileId = lastAssistant.previewUrl.split("/").pop()?.replace(".png", "");
    if (!previewFileId) {
      throw new Error("Could not determine preview file ID");
    }
    const previewPath = this.fileStorage.getPreviewPath(previewFileId);

    writeSse(res, SSE_EVENTS.validating, {
      message: "Analyzing rejected preview...",
      previewUrl: lastAssistant.previewUrl,
    });

    // Get AI analysis of what went wrong and how to fix it
    const analysis = await this.compilationAgent.rejectPreviewAndRetry(
      previewPath,
      originalPrompt,
      mostRecentScadCode
    );

    logger.info("Preview rejection analyzed", {
      conversationId,
      issues: analysis.issues,
      plan: analysis.plan,
    });

    writeSse(res, SSE_EVENTS.validationFailed, {
      message: "User rejected preview - regenerating with improvements.",
      reason: analysis.plan,
      issues: analysis.issues,
      previewUrl: lastAssistant.previewUrl,
    });

    // Record the rejection with the AI's analysis as feedback
    const feedbackMessage = `User rejected the preview. Issues identified: ${analysis.issues.join("; ")}. Fix plan: ${analysis.plan}`;
    await this.retryFeedbackAgent.recordFailure(
      "validation",
      conversationId,
      lastAssistant.scadCode,
      format,
      feedbackMessage,
      lastAssistant.previewUrl
    );

    // Regenerate code with the feedback incorporated
    await this.generateAndCompileWithRetry(res, conversationId, originalPrompt, format, false);
  }
}
