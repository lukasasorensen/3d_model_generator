import { AiClient } from "../clients/aiClient";
import { Message } from "../../../shared/src/types/model";
import { logger } from "../infrastructure/logger/logger";

/**
 * OpenSCAD-specific AI service.
 * Handles code generation for OpenSCAD models using an AI client.
 */
export class OpenScadAiService {
  private systemPrompt: string;

  constructor(private aiClient: AiClient) {
    logger.debug("Initializing OpenScadAiService");
    this.systemPrompt = `You are an expert OpenSCAD programmer. Generate ONLY valid OpenSCAD code based on user descriptions.

CRITICAL RULES:
- Output PURE OpenSCAD code ONLY
- NO markdown code blocks (no \`\`\` markers)
- NO explanations before or after the code
- NO text like "Here is..." or "This code..."
- Start directly with OpenSCAD code
- End with the last line of OpenSCAD code
- Use appropriate dimensions in millimeters
- Add inline // comments ONLY when necessary for clarity
- Ensure the code will successfully compile
- Use standard OpenSCAD primitives: cube, sphere, cylinder, etc.
- Apply transformations (translate, rotate, scale) as needed
- Use CSG operations (union, difference, intersection) when appropriate

When modifying existing code based on follow-up requests:
- Take the previous OpenSCAD code into account
- Apply the requested modifications while keeping the rest of the design intact
- Output the complete, updated OpenSCAD code`;

    logger.debug("OpenScadAiService initialized");
  }

  /**
   * Generate OpenSCAD code with conversation history for context
   */
  async *generateOpenSCADCodeStreamWithHistory(
    messages: Message[]
  ): AsyncGenerator<string, void, unknown> {
    const conversationInput = this.buildConversationInput(messages);
    logger.info("Starting streaming code generation with history", {
      messageCount: messages.length,
      inputLength: conversationInput.length,
    });

    let totalChunks = 0;
    let totalLength = 0;

    for await (const chunk of this.aiClient.streamCompletion(
      this.systemPrompt,
      conversationInput
    )) {
      totalChunks++;
      totalLength += chunk.length;
      yield chunk;
    }

    logger.info("Streaming code generation completed", {
      totalChunks,
      totalLength,
    });
  }

  /**
   * Build conversation input from message history
   * Includes both user prompts and assistant's generated code for context
   */
  private buildConversationInput(messages: Message[]): string {
    if (messages.length === 0) {
      logger.error("No messages provided for conversation input");
      throw new Error("No messages provided");
    }

    // For a single message, just return the prompt
    if (messages.length === 1) {
      logger.debug("Building conversation input for single message");
      return messages[0].content;
    }

    // Build context from conversation history
    logger.debug("Building conversation input from message history", {
      messageCount: messages.length,
    });
    const parts: string[] = [];

    for (const msg of messages) {
      if (msg.role === "user") {
        parts.push(`User request: ${msg.content}`);
      } else if (msg.role === "assistant" && msg.scadCode) {
        parts.push(`Previous OpenSCAD code:\n${msg.scadCode}`);
      }
    }

    const input = parts.join("\n\n");
    logger.debug("Conversation input built", {
      partsCount: parts.length,
      inputLength: input.length,
    });
    return input;
  }

  /**
   * Legacy method for single prompt generation (streaming)
   */
  async *generateOpenSCADCodeStream(
    prompt: string
  ): AsyncGenerator<string, void, unknown> {
    logger.info("Starting streaming code generation", {
      promptLength: prompt.length,
    });

    let totalChunks = 0;
    let totalLength = 0;

    for await (const chunk of this.aiClient.streamCompletion(
      this.systemPrompt,
      prompt
    )) {
      totalChunks++;
      totalLength += chunk.length;
      yield chunk;
    }

    logger.info("Streaming code generation completed", {
      totalChunks,
      totalLength,
    });
  }

  async generateOpenSCADCode(prompt: string): Promise<string> {
    logger.info("Starting non-streaming code generation", {
      promptLength: prompt.length,
    });
    let code = "";
    for await (const chunk of this.generateOpenSCADCodeStream(prompt)) {
      code += chunk;
    }
    const cleanedCode = this.cleanCode(code);
    logger.info("Non-streaming code generation completed", {
      codeLength: cleanedCode.length,
    });
    return cleanedCode;
  }

  cleanCode(code: string): string {
    let cleaned = code.trim();

    if (cleaned.startsWith("```openscad")) {
      logger.debug("Removing openscad markdown code block markers");
      cleaned = cleaned.replace(/^```openscad\n/, "");
    } else if (cleaned.startsWith("```")) {
      logger.debug("Removing generic markdown code block markers");
      cleaned = cleaned.replace(/^```\n/, "");
    }

    if (cleaned.endsWith("```")) {
      cleaned = cleaned.replace(/\n```$/, "");
    }

    return cleaned.trim();
  }
}
