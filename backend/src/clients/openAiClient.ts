import OpenAI from "openai";
import { AiClient } from "./aiClient";
import { logger } from "../infrastructure/logger/logger";

/**
 * OpenAI implementation of the AI client.
 * Provides generic streaming completion functionality using the OpenAI API.
 */
export class OpenAiClient extends AiClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    super();
    logger.debug("Initializing OpenAI client");
    this.client = new OpenAI({ apiKey });
    logger.debug("OpenAI client initialized");
  }

  /**
   * Stream a completion from the OpenAI API.
   * @param systemPrompt - The system instructions for the AI
   * @param input - The user input/prompt
   * @yields Chunks of generated text
   */
  async *streamCompletion(
    systemPrompt: string,
    input: string
  ): AsyncGenerator<string, void, unknown> {
    logger.debug("Starting streaming completion", {
      systemPromptLength: systemPrompt.length,
      inputLength: input.length,
    });

    try {
      const stream = this.client.responses.stream({
        model: "gpt-5",
        instructions: systemPrompt,
        input: input,
      });

      let totalChunks = 0;
      let totalLength = 0;

      for await (const event of stream) {
        if (event.type === "response.output_text.delta" && event.delta) {
          totalChunks++;
          totalLength += event.delta.length;
          yield event.delta;
        }
      }

      logger.debug("Streaming completion finished", {
        totalChunks,
        totalLength,
      });
    } catch (error: any) {
      logger.error("OpenAI API error during streaming", {
        error: error.message,
        code: error.code,
        status: error.status,
      });

      if (error.code === "insufficient_quota") {
        throw new Error(
          "OpenAI API quota exceeded. Please check your account."
        );
      }
      if (error.status === 401) {
        throw new Error("Invalid OpenAI API key");
      }
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }
}
