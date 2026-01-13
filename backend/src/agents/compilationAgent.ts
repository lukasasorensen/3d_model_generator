import * as fs from "fs/promises";
import * as path from "path";
import { OpenSCADService } from "../services/openscadService";
import { FileStorageService } from "../services/fileStorageService";
import { logger } from "../infrastructure/logger/logger";
import { exec } from "child_process";
import { promisify } from "util";
import { AiClient } from "../clients/aiClient";
import { config } from "../config/config";

const execAsync = promisify(exec);

export class VisionCheckError extends Error {
  constructor(
    message: string,
    public previewUrl: string,
    public compiled: {
      fileId: string;
      outputPath: string;
      modelUrl: string;
      previewPath: string;
    }
  ) {
    super(message);
    this.name = "VisionCheckError";
  }
}

export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileError";
  }
}

export class CompilationAgent {
  constructor(
    private openscadService: OpenSCADService,
    private fileStorage: FileStorageService,
    private aiClient: AiClient
  ) {}

  async compileModel({
    scadCode,
    prompt,
    format = "stl",
    validate = false,
    onValidationStart,
  }: {
    scadCode: string;
    prompt: string;
    format?: "stl" | "3mf";
    validate?: boolean;
    onValidationStart?: (previewUrl: string) => void;
  }): Promise<{
    fileId: string;
    outputPath: string;
    modelUrl: string;
    previewPath: string;
    previewUrl: string;
  }> {
    const { id: fileId, filePath: scadPath } =
      await this.fileStorage.saveScadFile(scadCode);
    const outputPath = this.fileStorage.getOutputPath(fileId, format);

    try {
      if (format === "stl") {
        await this.openscadService.generateSTL(scadPath, outputPath);
      } else {
        await this.openscadService.generate3MF(scadPath, outputPath);
      }
    } catch (error: any) {
      throw new CompileError(`Failed to compile model: ${error.message}`);
    }

    const previewPath = await this.generatePreview(scadPath, fileId);

    const previewUrl = `/api/previews/${fileId}.png`;
    const compiled = {
      fileId,
      outputPath,
      modelUrl: `/api/models/${fileId}/${format}`,
      previewPath,
    };

    if (validate) {
      onValidationStart?.(previewUrl);
      await this.validatePreview(prompt, previewPath, previewUrl, compiled);
    }

    return {
      fileId: compiled.fileId,
      outputPath: compiled.outputPath,
      modelUrl: compiled.modelUrl,
      previewPath,
      previewUrl,
    };
  }

  private async generatePreview(
    scadPath: string,
    fileId: string
  ): Promise<string> {
    const previewsDir = path.join(
      path.dirname(path.dirname(scadPath)),
      "previews"
    );
    await fs.mkdir(previewsDir, { recursive: true });
    const previewPath = path.join(previewsDir, `${fileId}.png`);

    const command = `openscad -o "${previewPath}" --imgsize=800,600 --viewall --autocenter "${scadPath}"`;
    logger.debug("Generating OpenSCAD preview", { command, previewPath });

    try {
      await execAsync(command, { timeout: 60000 });
      return previewPath;
    } catch (error: any) {
      logger.error("Failed to generate preview image", {
        error: error.message,
        previewPath,
      });
      throw new Error(`Failed to generate preview image: ${error.message}`);
    }
  }

  private async validatePreview(
    prompt: string,
    previewPath: string,
    previewUrl: string,
    compiled: {
      fileId: string;
      outputPath: string;
      modelUrl: string;
      previewPath: string;
    }
  ): Promise<void> {
    const imageBuffer = await fs.readFile(previewPath);
    const imageBase64 = imageBuffer.toString("base64");
    const output = await this.aiClient.visionCompletion({
      prompt:
        "You are a strict QA for 3D models. Compare the user prompt to the rendered preview." +
        ' Reply with JSON only: {"status":"ok"|"update","reason":"..."}.' +
        ` Prompt: ${prompt}`,
      imageBase64,
      modelTier: "medium",
    });

    let verdict: { status?: string; reason?: string } = {};
    if (typeof output === "string") {
      try {
        verdict = JSON.parse(output);
      } catch {
        verdict = { status: "update", reason: output || "Unclear response" };
      }
    } else {
      verdict = output as { status?: string; reason?: string };
    }

    if (verdict.status === "ok") {
      return;
    }

    const reason =
      verdict.reason || "Visual check indicates the model needs updates";
    logger.warn("Vision QA requested update", { reason });
    throw new VisionCheckError(reason, previewUrl, compiled);
  }
}
