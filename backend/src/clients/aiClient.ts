/**
 * Abstract base class for AI clients.
 * Allows for different AI provider implementations (OpenAI, Claude, etc.)
 */
export abstract class AiClient {
  /**
   * Stream a completion from the AI model.
   * @param systemPrompt - The system instructions for the AI
   * @param input - The user input/prompt
   * @yields Chunks of generated text
   */
  abstract streamCompletion(
    systemPrompt: string,
    input: string
  ): AsyncGenerator<string, void, unknown>;
}
