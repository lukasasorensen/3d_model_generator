import {
  AiClient,
  InputMessage,
  StreamEvent,
  StreamEventHandler,
} from "../clients/aiClient";
import { Message } from "../../../shared/src/types/model";
import { logger } from "../infrastructure/logger/logger";

/**
 * OpenSCAD-specific stream event types
 * Extends the base AI events with OpenSCAD-specific context
 */
export type OpenScadStreamEventType =
  | "code_delta"
  | "reasoning_delta"
  | "tool_call_start"
  | "tool_call_delta"
  | "tool_call_end"
  | "done"
  | "error";

export interface BaseOpenScadEvent {
  type: OpenScadStreamEventType;
}

export interface CodeDeltaEvent extends BaseOpenScadEvent {
  type: "code_delta";
  delta: string;
}

export interface OpenScadReasoningDeltaEvent extends BaseOpenScadEvent {
  type: "reasoning_delta";
  delta: string;
}

export interface OpenScadToolCallStartEvent extends BaseOpenScadEvent {
  type: "tool_call_start";
  toolCallId: string;
  toolName: string;
}

export interface OpenScadToolCallDeltaEvent extends BaseOpenScadEvent {
  type: "tool_call_delta";
  toolCallId: string;
  argumentsDelta: string;
}

export interface OpenScadToolCallEndEvent extends BaseOpenScadEvent {
  type: "tool_call_end";
  toolCallId: string;
  arguments: string;
}

export interface OpenScadDoneEvent extends BaseOpenScadEvent {
  type: "done";
  totalCode: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface OpenScadErrorEvent extends BaseOpenScadEvent {
  type: "error";
  error: string;
  code?: string;
}

export type OpenScadStreamEvent =
  | CodeDeltaEvent
  | OpenScadReasoningDeltaEvent
  | OpenScadToolCallStartEvent
  | OpenScadToolCallDeltaEvent
  | OpenScadToolCallEndEvent
  | OpenScadDoneEvent
  | OpenScadErrorEvent;

export type OpenScadStreamEventHandler = (event: OpenScadStreamEvent) => void;

/**
 * OpenSCAD-specific AI service.
 * Handles code generation for OpenSCAD models using an AI client.
 */
export class CodeGenerationAgent {
  private systemPrompt: string;

  constructor(private aiClient: AiClient) {
    logger.debug("Initializing CodeGenerationAgent");
    this.systemPrompt = `# Instructions: 
- You are an expert OpenSCAD programmer. Your goal is to generate a 3d model based on the user's prompt. 
- Use OpenSCAD primitives to generate the model with the least amount of code possible, satisfying the user's request. 
- The simpler you can make the code and the resulting model, the less likely errors will occur.
- Follow User's instructions carefully and exactly.

CRITICAL RULES:
- Output PURE OpenSCAD code ONLY
- NO markdown code blocks (no \`\`\` markers)
- NO explanations before or after the code
- NO text like "Here is..." or "This code..."
- Create the simplest model that meets the user's request, unless specified otherwise.
- Start directly with OpenSCAD code
- End with the last line of OpenSCAD code
- Use appropriate dimensions in millimeters
- Add inline // comments ONLY when necessary for clarity
- Ensure the code will successfully compile
- Use standard OpenSCAD primitives: cube, sphere, cylinder, etc.

When modifying existing code based on follow-up requests:
- Take the previous OpenSCAD code into account
- Apply the requested modifications while keeping the rest of the design intact
- Output the complete, updated OpenSCAD code
- If user provides and error and asks to fix it, look at the previous OpenSCAD code and fix the code to fix the error.`;

    logger.debug("CodeGenerationAgent initialized");
  }

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
    const inputMessages = this.buildInputMessages(messages);
    logger.info("Starting streaming code generation", {
      messageCount: messages.length,
      inputMessageCount: inputMessages.length,
    });

    let accumulatedCode = "";
    let totalChunks = 0;

    await this.aiClient.streamCompletion(
      {
        systemPrompt: this.systemPrompt,
        messages: inputMessages,
        modelTier: "medium",
        reasoningEffort: "medium",
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
            const cleanedCode = this.cleanCode(accumulatedCode);
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

    return this.cleanCode(accumulatedCode);
  }

  /**
   * Helper to create a Message array from a single prompt
   * Used when there's no conversation history
   */
  createMessagesFromPrompt(prompt: string): Message[] {
    return [
      {
        id: "temp-user-message",
        conversationId: "temp",
        role: "user",
        content: prompt,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  /**
   * Build input messages from conversation history
   * Includes both user prompts and assistant's generated code for context
   */
  public buildInputMessages(messages: Message[]): InputMessage[] {
    if (messages.length === 0) {
      logger.error("No messages provided for conversation input");
      throw new Error("No messages provided");
    }

    logger.debug("Building input messages from conversation history", {
      messageCount: messages.length,
    });

    const inputMessages: InputMessage[] = [];

    for (const msg of messages) {
      const inputMessage: InputMessage = {
        role: msg.role,
        content: msg.content,
      };

      if (msg.role === "assistant" && msg.scadCode) {
        inputMessage.content = inputMessage.content + msg.scadCode;
      }

      inputMessages.push(inputMessage);
    }

    logger.debug("Input messages built", {
      inputMessageCount: inputMessages.length,
    });

    return inputMessages;
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
