import { Request, Response } from "express";
import { ModelGenerationRequest } from "../../../shared/src/types/model";
import { logger } from "../infrastructure/logger/logger";
import { SSE_EVENTS, setSseHeaders, writeSse } from "../utils/sseUtils";
import { ModelWorkflow } from "../workflows/modelWorkflows";

export class ModelController {
  constructor(private modelWorkflow: ModelWorkflow) {
    logger.debug("ModelController initialized");
  }

  async generateModelStream(req: Request, res: Response): Promise<void> {
    const {
      prompt,
      format = "stl",
      conversationId,
      action = "generate",
    } = req.body as ModelGenerationRequest;
    if (action !== "finalize" && action !== "reject_preview_and_retry") {
      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        logger.warn("Invalid prompt provided for model generation");
        res.status(400).json({
          success: false,
          error: "Prompt is required and must be a non-empty string",
        });
        return;
      }

      if (prompt.length > 1000) {
        logger.warn("Prompt too long for model generation", {
          promptLength: prompt.length,
        });
        res.status(400).json({
          success: false,
          error: "Prompt is too long (maximum 1000 characters)",
        });
        return;
      }
    }

    if (format !== "stl" && format !== "3mf") {
      logger.warn("Invalid format specified for model generation", { format });
      res.status(400).json({
        success: false,
        error: 'Format must be either "stl" or "3mf"',
      });
      return;
    }

    if (conversationId !== undefined) {
      if (typeof conversationId !== "string" || conversationId.trim() === "") {
        logger.warn("Invalid conversationId provided for model generation");
        res.status(400).json({
          success: false,
          error: "conversationId must be a non-empty string",
        });
        return;
      }

      const conversation = await this.modelWorkflow.getConversation(
        conversationId
      );
      if (!conversation) {
        res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
        return;
      }
    } else if (action === "finalize" || action === "reject_preview_and_retry") {
      res.status(400).json({
        success: false,
        error: `conversationId is required to ${action} a model`,
      });
      return;
    }

    setSseHeaders(res);
    logger.debug("SSE connection established for model generation");

    try {
      if (action === "finalize") {
        await this.modelWorkflow.finalizeModelStream(
          res,
          conversationId as string,
          format
        );
      } else if (action === "reject_preview_and_retry") {
        await this.modelWorkflow.rejectAndRetryStream(
          res,
          conversationId as string,
          format
        );
      } else {
        await this.modelWorkflow.generateModelStream(
          res,
          prompt as string,
          format,
          conversationId
        );
      }
      res.end();
    } catch (error: any) {
      logger.error("Error generating model (streaming)", {
        error: error.message,
        stack: error.stack,
      });
      writeSse(res, SSE_EVENTS.error, {
        error: error.message || "Failed to generate model",
      });
      res.end();
    }
  }

  async getModelFile(req: Request, res: Response): Promise<void> {
    const { id, format } = req.params;

    try {
      if (format !== "stl" && format !== "3mf") {
        logger.warn("Invalid format requested for model file", {
          fileId: id,
          format,
        });
        res.status(400).json({
          success: false,
          error: 'Format must be either "stl" or "3mf"',
        });
        return;
      }

      const result = await this.modelWorkflow.getModelFile(
        id,
        format as "stl" | "3mf"
      );

      if (!result) {
        res.status(404).json({
          success: false,
          error: "Model file not found",
        });
        return;
      }

      res.sendFile(result.filePath);
    } catch (error: any) {
      logger.error("Error retrieving model file", {
        fileId: id,
        format,
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        error: "Failed to retrieve model file",
      });
    }
  }
}
