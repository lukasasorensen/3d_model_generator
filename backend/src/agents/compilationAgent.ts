import * as fs from "fs/promises";
import { OpenSCADService, CompileError } from "../services/openscadService";
import { logger } from "../infrastructure/logger/logger";
import { AiClient } from "../clients/aiClient";

export { CompileError };

export class VisionCheckError extends Error {
  constructor(
    message: string,
    public previewUrl: string,
    public compiled: {
      fileId: string;
      previewPath: string;
      scadPath: string;
    }
  ) {
    super(message);
    this.name = "VisionCheckError";
  }
}

export class CompilationAgent {
  constructor(
    private aiClient: AiClient
  ) { }

  async validatePreview(
    prompt: string,
    previewPath: string,
    previewUrl: string,
    compiled: {
      fileId: string;
      previewPath: string;
      scadPath: string;
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
