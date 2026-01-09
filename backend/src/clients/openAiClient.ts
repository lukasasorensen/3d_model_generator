import OpenAI from "openai";
import { AiClient, InputMessage, StreamCompletionParams } from "./aiClient";
import { logger } from "../infrastructure/logger/logger";
import { config } from "../config/config";

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
   * Convert generic InputMessage array to OpenAI's input format.
   * OpenAI Responses API uses an array of input items with type and content.
   */
  private convertToOpenAiInput(
    messages: InputMessage[]
  ): Array<{ role: "user" | "assistant" | "system"; content: string }> {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Stream a completion from the OpenAI API.
   * @param systemPrompt - The system instructions for the AI
   * @param messages - Array of conversation messages
   * @yields Chunks of generated text
   */
  async *streamCompletion({
    systemPrompt,
    messages,
    modelTier = "small",
  }: StreamCompletionParams): AsyncGenerator<string, void, unknown> {
    logger.debug("Starting streaming completion", {
      systemPromptLength: systemPrompt.length,
      messageCount: messages.length,
    });

    try {
      const openAiInput = this.convertToOpenAiInput(messages);

      const stream = this.client.responses.stream({
        model: this.getModelForTier(modelTier ?? "small"),
        instructions: systemPrompt,
        input: openAiInput,
      });

      let totalChunks = 0;
      let totalLength = 0;

      for await (const event of stream) {
        logger.debug("OpenAI event", { event });
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

  private getModelForTier(
    modelTier: "tiny" | "small" | "medium" | "large" | "xlarge"
  ): string {
    switch (modelTier) {
      case "tiny":
        return config.openai.models.tiny;
      case "small":
        return config.openai.models.small;
      case "medium":
        return config.openai.models.medium;
      case "large":
        return config.openai.models.large;
      case "xlarge":
        return config.openai.models.xlarge;
      default:
        return config.openai.models.small;
    }
  }
}
