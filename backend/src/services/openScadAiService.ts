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
export class OpenScadAiService {
  private systemPrompt: string;

  constructor(private aiClient: AiClient) {
    logger.debug("Initializing OpenScadAiService");
    

    logger.debug("OpenScadAiService initialized");
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
      if (msg.role === "user") {
        inputMessages.push({
          role: "user",
          content: msg.content,
        });
      } else if (msg.role === "assistant" && msg.scadCode) {
        inputMessages.push({
          role: "assistant",
          content: msg.scadCode,
        });
      }
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
