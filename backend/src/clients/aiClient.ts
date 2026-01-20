import { z } from "zod/v3";

/**
 * Represents a message in the conversation.
 * Each AI client implementation converts these to their specific format.
 */
export interface InputMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamCompletionParams {
  systemPrompt: string;
  messages: InputMessage[];
  modelTier?: "tiny" | "small" | "medium" | "large" | "xlarge";
  reasoningEffort?: "none" | "low" | "medium" | "high";
}

export interface VisionCompletionParams<T = string> {
  prompt: string;
  imageBase64: string;
  messages?: InputMessage[];
  modelTier?: "tiny" | "small" | "medium" | "large" | "xlarge";
  structuredOutput?: z.ZodType<T, any, any>;
}

/**
 * SSE Stream Event Types
 * These represent different types of content that can be streamed from the AI.
 */
export type StreamEventType =
  | "text_delta"
  | "reasoning_delta"
  | "tool_call_start"
  | "tool_call_delta"
  | "tool_call_end"
  | "done"
  | "error";

/**
 * Base interface for all stream events
 */
export interface BaseStreamEvent {
  type: StreamEventType;
}

/**
 * Text content delta event
 */
export interface TextDeltaEvent extends BaseStreamEvent {
  type: "text_delta";
  delta: string;
}

/**
 * Reasoning/thinking content delta event
 */
export interface ReasoningDeltaEvent extends BaseStreamEvent {
  type: "reasoning_delta";
  delta: string;
}

/**
 * Tool call started event
 */
export interface ToolCallStartEvent extends BaseStreamEvent {
  type: "tool_call_start";
  toolCallId: string;
  toolName: string;
}

/**
 * Tool call argument delta event
 */
export interface ToolCallDeltaEvent extends BaseStreamEvent {
  type: "tool_call_delta";
  toolCallId: string;
  argumentsDelta: string;
}

/**
 * Tool call completed event
 */
export interface ToolCallEndEvent extends BaseStreamEvent {
  type: "tool_call_end";
  toolCallId: string;
  arguments: string;
}

/**
 * Stream completed event
 */
export interface DoneEvent extends BaseStreamEvent {
  type: "done";
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Error event
 */
export interface ErrorEvent extends BaseStreamEvent {
  type: "error";
  error: string;
  code?: string;
}

/**
 * Union type of all possible stream events
 */
export type StreamEvent =
  | TextDeltaEvent
  | ReasoningDeltaEvent
  | ToolCallStartEvent
  | ToolCallDeltaEvent
  | ToolCallEndEvent
  | DoneEvent
  | ErrorEvent;

/**
 * Callback function for handling stream events
 */
export type StreamEventHandler = (event: StreamEvent) => void;

/**
 * Abstract base class for AI clients.
 * Allows for different AI provider implementations (OpenAI, Claude, etc.)
 */
export abstract class AiClient {
  /**
   * Stream a completion from the AI model using event callbacks.
   * @param params - The completion parameters (systemPrompt, messages, modelTier)
   * @param onEvent - Callback function called for each stream event
   * @returns Promise that resolves when streaming is complete
   */
  abstract streamCompletion(
    params: StreamCompletionParams,
    onEvent: StreamEventHandler
  ): Promise<void>;

  /**
   * Run a single-shot vision completion and return the raw text output.
   * @param params - The vision completion parameters
   */
  abstract visionCompletion<T = string>(
    params: VisionCompletionParams<T>
  ): Promise<T>;
}
