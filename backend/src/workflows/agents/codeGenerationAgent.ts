import {
  OpenScadStreamEvent,
  OpenScadAiService,
  OpenScadStreamEventHandler,
} from "../../services/openScadAiService";
import { ConversationService } from "../../services/conversationService";
import { logger } from "../../infrastructure/logger/logger";
import { Message } from "../../../../shared/src/types/model";
import { AiClient, StreamEvent } from "../../clients/aiClient";

const SYSTEM_PROMPT = `You are an expert OpenSCAD programmer. Generate ONLY valid OpenSCAD code based on user descriptions.

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

export class CodeGenerationAgent {
  constructor(
    private openScadAiService: OpenScadAiService,
    private aiClient: AiClient
  ) {}

  /**
   * Generate OpenSCAD code with conversation history using event-based streaming
   * @param messages - Array of conversation messages
   * @param onEvent - Callback function called for each stream event
   * @returns Promise that resolves with the complete generated code
   */
  async generateCode(
    messages: Message[],
    onEvent: OpenScadStreamEventHandler
  ): Promise<string> {
    const inputMessages = this.openScadAiService.buildInputMessages(messages);
    logger.info("Starting streaming code generation", {
      messageCount: messages.length,
      inputMessageCount: inputMessages.length,
    });

    let accumulatedCode = "";
    let totalChunks = 0;

    await this.aiClient.streamCompletion(
      {
        systemPrompt: SYSTEM_PROMPT,
        messages: inputMessages,
        modelTier: "medium",
        reasoningEffort: "none",
      },
      (event: StreamEvent) => {
        switch (event.type) {
          case "text_delta":
            accumulatedCode += event.delta;
            totalChunks++;
            onEvent({
              type: "code_delta",
              delta: event.delta,
            });
            break;

          case "reasoning_delta":
            onEvent({
              type: "reasoning_delta",
              delta: event.delta,
            });
            break;

          case "tool_call_start":
            onEvent({
              type: "tool_call_start",
              toolCallId: event.toolCallId,
              toolName: event.toolName,
            });
            break;

          case "tool_call_delta":
            onEvent({
              type: "tool_call_delta",
              toolCallId: event.toolCallId,
              argumentsDelta: event.argumentsDelta,
            });
            break;

          case "tool_call_end":
            onEvent({
              type: "tool_call_end",
              toolCallId: event.toolCallId,
              arguments: event.arguments,
            });
            break;

          case "done":
            // Clean the code before sending done event
            const cleanedCode =
              this.openScadAiService.cleanCode(accumulatedCode);
            onEvent({
              type: "done",
              totalCode: cleanedCode,
              usage: event.usage,
            });
            break;

          case "error":
            onEvent({
              type: "error",
              error: event.error,
              code: event.code,
            });
            break;
        }
      }
    );

    logger.info("Streaming code generation completed", {
      totalChunks,
      totalLength: accumulatedCode.length,
    });

    return this.openScadAiService.cleanCode(accumulatedCode);
  }
}
