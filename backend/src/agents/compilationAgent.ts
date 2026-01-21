import * as fs from "fs/promises";
import { logger } from "../infrastructure/logger/logger";
import { AiClient, InputMessage } from "../clients/aiClient";

export interface RejectionAnalysis {
  issues: string[];
  plan: string;
}

export class CompilationAgent {
  constructor(
    private aiClient: AiClient
  ) { }

  /**
   * Analyzes a rejected preview and creates a plan to fix issues based on conversation history.
   * Called when the user rejects a generated preview.
   */
  async rejectPreviewAndRetry(
    previewPath: string,
    originalPrompt: string,
    scadCode: string
  ): Promise<RejectionAnalysis> {
    const imageBuffer = await fs.readFile(previewPath);
    const imageBase64 = imageBuffer.toString("base64");

    const output = await this.aiClient.visionCompletion({
      prompt:
        this.#buildPrompt(originalPrompt, scadCode),
      imageBase64,
      modelTier: "medium",
    });

    let analysis: RejectionAnalysis = { issues: [], plan: "" };

    if (typeof output === "string") {
      try {
        const parsed = JSON.parse(output);
        analysis = {
          issues: Array.isArray(parsed.issues) ? parsed.issues : [],
          plan: parsed.plan || "Regenerate the model with closer attention to the original request.",
        };
      } catch {
        // If JSON parsing fails, treat the entire output as the plan
        analysis = {
          issues: ["Unable to parse specific issues"],
          plan: output || "Regenerate the model with closer attention to the original request.",
        };
      }
    } else {
      const parsed = output as { issues?: string[]; plan?: string };
      analysis = {
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        plan: parsed.plan || "Regenerate the model with closer attention to the original request.",
      };
    }

    logger.info("Rejection analysis completed", {
      issueCount: analysis.issues.length,
      planLength: analysis.plan.length,
    });

    return analysis;
  }

  #buildPrompt(originalPrompt: string, scadCode: string): string {
    return `
    # Instructions
    - You are an expert OpenSCAD programmer. 
    - Provided with the user's original request and the OpenSCAD code that was used to generate the preview image you will analyze the preview image and create a plan to fix the issues based on the provided code and preview image.

    # Context
    - AI has generated OpenSCAD code to create a 3d model based on the user's request and rendered a preview image of the model for the user to see.
    - The user has REJECTED this 3D model preview and is asking you to fix the issues based on the provided code and preview image.

    # User Original Request
    - ${originalPrompt}

    # OpenSCAD Code
    - ${scadCode}
    `;
  }
}
