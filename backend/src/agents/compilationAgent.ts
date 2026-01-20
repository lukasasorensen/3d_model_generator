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
    conversationMessages: InputMessage[],
    previewPath: string,
    originalPrompt: string
  ): Promise<RejectionAnalysis> {
    const imageBuffer = await fs.readFile(previewPath);
    const imageBase64 = imageBuffer.toString("base64");

    const output = await this.aiClient.visionCompletion({
      prompt:
        "The user has REJECTED this 3D model preview. Your job is to analyze what might be wrong.\n\n" +
        `The user's original request was: "${originalPrompt}"\n\n` +
        "Examine the preview image and identify discrepancies or issues compared to what was requested.\n\n" +
        "Based on the conversation history and the preview image, identify:\n" +
        "1. What issues you can see in the preview that don't match the user's request\n" +
        "2. A concrete plan for how to fix the OpenSCAD code to address these issues\n\n" +
        'Reply with JSON only: {"issues":["issue1","issue2",...],"plan":"detailed plan to fix the code"}',
      imageBase64,
      messages: conversationMessages,
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
}
