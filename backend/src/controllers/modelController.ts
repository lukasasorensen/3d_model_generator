import { Request, Response } from "express";
import {
  OpenScadAiService,
  OpenScadStreamEvent,
} from "../services/openScadAiService";
import { OpenSCADService } from "../services/openscadService";
import { FileStorageService } from "../services/fileStorageService";
import { ModelGenerationRequest } from "../../../shared/src/types/model";
import { logger } from "../infrastructure/logger/logger";

export class ModelController {
  constructor(
    private openScadAiService: OpenScadAiService,
    private openscadService: OpenSCADService,
    private fileStorage: FileStorageService
  ) {
    logger.debug("ModelController initialized");
  }

  /**
   * Helper to write SSE events to the response
   */
  private writeSSE(res: Response, eventType: string, data: any): void {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  async generateModelStream(req: Request, res: Response): Promise<void> {
    const { prompt, format = "stl" } = req.body as ModelGenerationRequest;
    logger.info("Generating model (streaming)", {
      promptLength: prompt?.length,
      format,
    });

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

    if (format !== "stl" && format !== "3mf") {
      logger.warn("Invalid format specified for model generation", { format });
      res.status(400).json({
        success: false,
        error: 'Format must be either "stl" or "3mf"',
      });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    logger.debug("SSE connection established for model generation");

    try {
      this.writeSSE(res, "generation_start", {
        message: "Generating OpenSCAD code...",
      });

      logger.info("Starting OpenSCAD code generation");
      let chunkCount = 0;

      // Create a message array from the prompt for the unified API
      const messages = this.openScadAiService.createMessagesFromPrompt(prompt);

      const scadCode = await this.openScadAiService.generateCode(
        messages,
        (event: OpenScadStreamEvent) => {
          switch (event.type) {
            case "code_delta":
              chunkCount++;
              this.writeSSE(res, "code_delta", { chunk: event.delta });
              break;

            case "reasoning_delta":
              this.writeSSE(res, "reasoning_delta", { chunk: event.delta });
              break;

            case "tool_call_start":
              this.writeSSE(res, "tool_call_start", {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
              });
              break;

            case "tool_call_delta":
              this.writeSSE(res, "tool_call_delta", {
                toolCallId: event.toolCallId,
                argumentsDelta: event.argumentsDelta,
              });
              break;

            case "tool_call_end":
              this.writeSSE(res, "tool_call_end", {
                toolCallId: event.toolCallId,
                arguments: event.arguments,
              });
              break;

            case "done":
              this.writeSSE(res, "code_complete", {
                code: event.totalCode,
                usage: event.usage,
              });
              break;

            case "error":
              this.writeSSE(res, "generation_error", {
                error: event.error,
                code: event.code,
              });
              break;
          }
        }
      );

      logger.info("Code generation completed", {
        codeLength: scadCode.length,
        chunkCount,
      });

      const { id, filePath: scadPath } = await this.fileStorage.saveScadFile(
        scadCode
      );
      logger.debug("SCAD file saved", { fileId: id, scadPath });

      this.writeSSE(res, "compiling", {
        message: "Compiling with OpenSCAD...",
      });

      const outputPath = this.fileStorage.getOutputPath(id, format);
      logger.info("Compiling 3D model", { fileId: id, format });

      if (format === "stl") {
        await this.openscadService.generateSTL(scadPath, outputPath);
      } else {
        await this.openscadService.generate3MF(scadPath, outputPath);
      }
      logger.info("3D model compiled successfully", {
        fileId: id,
        format,
        outputPath,
      });

      this.writeSSE(res, "completed", {
        data: {
          id,
          prompt,
          scadCode,
          modelUrl: `/api/models/${id}/${format}`,
          format,
          generatedAt: new Date().toISOString(),
          status: "completed",
        },
      });

      logger.info("Model generation completed successfully", {
        fileId: id,
        modelUrl: `/api/models/${id}/${format}`,
      });
      res.end();
    } catch (error: any) {
      logger.error("Error generating model (streaming)", {
        error: error.message,
        stack: error.stack,
      });
      this.writeSSE(res, "error", {
        error: error.message || "Failed to generate model",
      });
      res.end();
    }
  }

  async getModelFile(req: Request, res: Response): Promise<void> {
    const { id, format } = req.params;
    logger.info("Retrieving model file", { fileId: id, format });

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

      const filePath = this.fileStorage.getOutputPath(
        id,
        format as "stl" | "3mf"
      );

      const exists = await this.fileStorage.fileExists(filePath);
      if (!exists) {
        logger.warn("Model file not found", { fileId: id, format, filePath });
        res.status(404).json({
          success: false,
          error: "Model file not found",
        });
        return;
      }

      logger.info("Sending model file", { fileId: id, format, filePath });
      res.sendFile(filePath);
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
