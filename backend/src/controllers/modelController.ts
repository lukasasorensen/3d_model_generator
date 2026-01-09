import { Request, Response } from "express";
import { OpenScadAiService } from "../services/openScadAiService";
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
      let scadCode = "";

      res.write(
        `data: ${JSON.stringify({
          type: "start",
          message: "Generating OpenSCAD code...",
        })}\n\n`
      );

      logger.info("Starting OpenSCAD code generation");
      let chunkCount = 0;
      for await (const chunk of this.openScadAiService.generateOpenSCADCodeStream(
        prompt
      )) {
        scadCode += chunk;
        chunkCount++;
        res.write(`data: ${JSON.stringify({ type: "code_chunk", chunk })}\n\n`);
      }
      logger.info("Code generation completed", {
        codeLength: scadCode.length,
        chunkCount,
      });

      res.write(
        `data: ${JSON.stringify({ type: "code_complete", code: scadCode })}\n\n`
      );

      const { id, filePath: scadPath } = await this.fileStorage.saveScadFile(
        scadCode
      );
      logger.debug("SCAD file saved", { fileId: id, scadPath });

      res.write(
        `data: ${JSON.stringify({
          type: "compiling",
          message: "Compiling with OpenSCAD...",
        })}\n\n`
      );

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

      res.write(
        `data: ${JSON.stringify({
          type: "completed",
          data: {
            id,
            prompt,
            scadCode,
            modelUrl: `/api/models/${id}/${format}`,
            format,
            generatedAt: new Date().toISOString(),
            status: "completed",
          },
        })}\n\n`
      );

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
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: error.message || "Failed to generate model",
        })}\n\n`
      );
      res.end();
    }
  }

  async generateModel(req: Request, res: Response): Promise<void> {
    const { prompt, format = "stl" } = req.body as ModelGenerationRequest;
    logger.info("Generating model (non-streaming)", {
      promptLength: prompt?.length,
      format,
    });

    try {
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
        logger.warn("Invalid format specified for model generation", {
          format,
        });
        res.status(400).json({
          success: false,
          error: 'Format must be either "stl" or "3mf"',
        });
        return;
      }

      logger.info("Generating OpenSCAD code");
      const scadCode = await this.openScadAiService.generateOpenSCADCode(
        prompt
      );
      logger.info("Code generation completed", { codeLength: scadCode.length });

      const { id, filePath: scadPath } = await this.fileStorage.saveScadFile(
        scadCode
      );
      logger.debug("SCAD file saved", { fileId: id, scadPath });

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

      const modelUrl = `/api/models/${id}/${format}`;
      logger.info("Model generation completed successfully", {
        fileId: id,
        modelUrl,
      });

      res.json({
        success: true,
        data: {
          id,
          prompt,
          scadCode,
          modelUrl,
          format,
          generatedAt: new Date().toISOString(),
          status: "completed",
        },
      });
    } catch (error: any) {
      logger.error("Error generating model (non-streaming)", {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        error: error.message || "Failed to generate model",
      });
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
