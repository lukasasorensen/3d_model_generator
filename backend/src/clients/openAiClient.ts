import OpenAI from "openai";
import {
  AiClient,
  InputMessage,
  StreamCompletionParams,
  StreamEventHandler,
  VisionCompletionParams,
} from "./aiClient";
import { logger } from "../infrastructure/logger/logger";
import { config } from "../config/config";
import { ReasoningEffort } from "openai/resources/shared";
import { ResponseStreamParams } from "openai/lib/responses/ResponseStream";
import { ResponseCreateParams } from "openai/resources/responses/responses";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { zodTextFormat } = require("openai/helpers/zod") as {
  zodTextFormat: (schema: unknown, name: string) => unknown;
};

/**
 * OpenAI implementation of the AI client.
 * Provides event-based SSE streaming using the OpenAI API.
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
   * Stream a completion from the OpenAI API using event callbacks.
   * @param params - The completion parameters
   * @param onEvent - Callback function called for each stream event
   */
  async streamCompletion(
    {
      systemPrompt,
      messages,
      modelTier = "small",
      reasoningEffort = "low",
    }: StreamCompletionParams,
    onEvent: StreamEventHandler
  ): Promise<void> {
    logger.debug("Starting streaming completion", {
      systemPromptLength: systemPrompt.length,
      messageCount: messages.length,
    });

    try {
      const openAiInput = this.convertToOpenAiInput(messages);

      const responseParams: ResponseStreamParams = {
        model: this.getModelForTier(modelTier ?? "small"),
        instructions: systemPrompt,
        input: openAiInput,
        stream: true,
      };

      // only for gpt-5 models
      if (responseParams.model.includes("gpt-5")) {
        responseParams.reasoning = {
          effort: this.getReasoningEffortForTier(
            reasoningEffort
          ) as ReasoningEffort,
        };

        if (reasoningEffort !== "none") {
          responseParams.reasoning.summary = "auto";
        }
      }

      const stream = this.client.responses.stream(responseParams);

      let totalChunks = 0;
      let totalLength = 0;

      // Track tool calls in progress
      const activeToolCalls: Map<string, { name: string; arguments: string }> =
        new Map();

      for await (const event of stream) {
        // dont include delta events in the logs as they are chunks of text that fill up the logs
        if (!event.type.includes("delta")) {
          logger.debug("OpenAI event", { eventType: event.type });
        }

        switch (event.type) {
          // Text output delta
          case "response.output_text.delta":
            if (event.delta) {
              totalChunks++;
              totalLength += event.delta.length;
              onEvent({
                type: "text_delta",
                delta: event.delta,
              });
            }
            break;

          // Reasoning/thinking delta (for reasoning models)
          case "response.reasoning_summary_text.delta":
            if (event.delta) {
              onEvent({
                type: "reasoning_delta",
                delta: event.delta,
              });
            }
            break;

          // Function call started
          case "response.function_call_arguments.delta":
            // OpenAI sends function call arguments as deltas
            // We need to track them by their call_id
            if (event.item_id) {
              const existing = activeToolCalls.get(event.item_id);
              if (existing) {
                existing.arguments += event.delta || "";
                onEvent({
                  type: "tool_call_delta",
                  toolCallId: event.item_id,
                  argumentsDelta: event.delta || "",
                });
              }
            }
            break;

          // Output item added - could be a function call
          case "response.output_item.added":
            if (event.item && event.item.type === "function_call") {
              const item = event.item as {
                id: string;
                call_id: string;
                name: string;
              };
              activeToolCalls.set(item.id, {
                name: item.name,
                arguments: "",
              });
              onEvent({
                type: "tool_call_start",
                toolCallId: item.id,
                toolName: item.name,
              });
            }
            break;

          // Output item completed - function call done
          case "response.output_item.done":
            if (event.item && event.item.type === "function_call") {
              const item = event.item as { id: string; arguments: string };
              const toolCall = activeToolCalls.get(item.id);
              if (toolCall) {
                onEvent({
                  type: "tool_call_end",
                  toolCallId: item.id,
                  arguments: item.arguments || toolCall.arguments,
                });
                activeToolCalls.delete(item.id);
              }
            }
            break;

          // Response completed
          case "response.completed":
            // Extract usage if available
            const response = event.response;
            const usage = response?.usage;
            onEvent({
              type: "done",
              usage: usage
                ? {
                  inputTokens: usage.input_tokens,
                  outputTokens: usage.output_tokens,
                }
                : undefined,
            });
            break;
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

      let errorMessage = error.message;
      let errorCode = error.code;

      if (error.code === "insufficient_quota") {
        errorMessage = "OpenAI API quota exceeded. Please check your account.";
      } else if (error.status === 401) {
        errorMessage = "Invalid OpenAI API key";
        errorCode = "auth_error";
      }

      onEvent({
        type: "error",
        error: errorMessage,
        code: errorCode,
      });

      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  async visionCompletion<T = string>({
    prompt,
    imageBase64,
    messages = [],
    modelTier = "medium",
    structuredOutput,
  }: VisionCompletionParams<T>): Promise<T> {
    logger.debug("Starting vision completion", {
      promptLength: prompt.length,
      imageSize: imageBase64.length,
      messageCount: messages.length,
    });

    // Build input array: conversation messages first, then the vision prompt with image
    const input: ResponseCreateParams["input"] = [];

    // Add conversation history as context
    for (const msg of messages) {
      (input as any[]).push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add the vision prompt with the image as the final user message
    (input as any[]).push({
      role: "user",
      content: [
        { type: "input_text", text: prompt },
        {
          type: "input_image",
          image_url: `data:image/png;base64,${imageBase64}`,
          detail: "auto",
        },
      ],
    });

    const responseParams: ResponseCreateParams = {
      model: this.getModelForTier(modelTier),
      input,
    };

    if (structuredOutput) {
      (responseParams as any).text = {
        format: zodTextFormat(structuredOutput, "structured_output"),
      };
    }

    const response = await this.client.responses.create(responseParams);

    const outputText =
      (response as any).output_text ||
      (response as any).output?.[0]?.content?.[0]?.text ||
      "";

    if (structuredOutput) {
      try {
        return JSON.parse(outputText) as T;
      } catch {
        logger.error("Invalid structured output", { outputText });
      }
    }

    logger.debug("Vision completion received", {
      outputLength: outputText.length,
    });

    return outputText as T;
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

  private getReasoningEffortForTier(
    reasoningEffort: "none" | "low" | "medium" | "high"
  ): string {
    switch (reasoningEffort) {
      case "none":
        return "minimal";
      case "low":
        return "low";
      case "medium":
        return "medium";
      case "high":
        return "high";
      default:
        return "low";
    }
  }
}
