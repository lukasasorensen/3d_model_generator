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
}

/**
 * Abstract base class for AI clients.
 * Allows for different AI provider implementations (OpenAI, Claude, etc.)
 */
export abstract class AiClient {
  /**
   * Stream a completion from the AI model.
   * @param systemPrompt - The system instructions for the AI
   * @param messages - Array of conversation messages
   * @yields Chunks of generated text
   */
  abstract streamCompletion({
    systemPrompt,
    messages,
    modelTier,
  }: StreamCompletionParams): AsyncGenerator<string, void, unknown>;
}
