import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, AIMessageChunk, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod/v3';
import {
  AiClient,
  InputMessage,
  StreamCompletionParams,
  StreamEventHandler,
  VisionCompletionParams
} from './aiClient';
import { logger } from '../infrastructure/logger/logger';
import { config } from '../config/config';

/**
 * OpenAI implementation of the AI client.
 * Provides event-based SSE streaming using the OpenAI API.
 */
export class OpenAiClient extends AiClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    super();
    logger.debug('Initializing OpenAI client');
    this.apiKey = apiKey;
    logger.debug('OpenAI client initialized');
  }

  /**
   * Convert generic InputMessage array to LangChain messages.
   */
  private convertToLangChainMessages(messages: InputMessage[]): BaseMessage[] {
    return messages.map((msg) => {
      if (msg.role === 'system') {
        return new SystemMessage(msg.content);
      }
      if (msg.role === 'assistant') {
        return new AIMessage({ content: msg.content });
      }
      return new HumanMessage(msg.content);
    });
  }

  /**
   * Stream a completion from the OpenAI API using event callbacks.
   * @param params - The completion parameters
   * @param onEvent - Callback function called for each stream event
   */
  async streamCompletion(
    { systemPrompt, messages, modelTier = 'small', reasoningEffort = 'low' }: StreamCompletionParams,
    onEvent: StreamEventHandler
  ): Promise<void> {
    logger.debug('Starting streaming completion', {
      systemPromptLength: systemPrompt.length,
      messageCount: messages.length
    });

    try {
      const model = this.createModel(this.getModelForTier(modelTier ?? 'small'), reasoningEffort);
      const langChainMessages: BaseMessage[] = [
        new SystemMessage(systemPrompt),
        ...this.convertToLangChainMessages(messages)
      ];

      let totalChunks = 0;
      let totalLength = 0;
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;

      const toolArgumentsById = new Map<string, string>();

      const stream = await model.stream(langChainMessages);
      for await (const chunk of stream) {
        this.captureUsage(chunk, (inTokens, outTokens) => {
          inputTokens = inTokens;
          outputTokens = outTokens;
        });

        for (const toolCallChunk of chunk.tool_call_chunks ?? []) {
          const toolCallId = toolCallChunk.id || `tool_${toolCallChunk.index ?? 0}`;
          const argumentsDelta = toolCallChunk.args || '';

          if (!toolArgumentsById.has(toolCallId)) {
            toolArgumentsById.set(toolCallId, '');
            onEvent({
              type: 'tool_call_start',
              toolCallId,
              toolName: toolCallChunk.name || 'unknown_tool'
            });
          }

          if (argumentsDelta) {
            toolArgumentsById.set(toolCallId, `${toolArgumentsById.get(toolCallId) || ''}${argumentsDelta}`);
            onEvent({
              type: 'tool_call_delta',
              toolCallId,
              argumentsDelta
            });
          }
        }

        const textDelta = this.extractText(chunk);
        if (textDelta) {
          totalChunks++;
          totalLength += textDelta.length;
          onEvent({
            type: 'text_delta',
            delta: textDelta
          });
        }
      }

      for (const [toolCallId, argumentsValue] of toolArgumentsById.entries()) {
        onEvent({
          type: 'tool_call_end',
          toolCallId,
          arguments: argumentsValue
        });
      }

      onEvent({
        type: 'done',
        usage:
          inputTokens !== undefined && outputTokens !== undefined
            ? {
                inputTokens,
                outputTokens
              }
            : undefined
      });

      logger.debug('Streaming completion finished', {
        totalChunks,
        totalLength
      });
    } catch (error: any) {
      logger.error('OpenAI API error during streaming', {
        error: error.message,
        code: error.code,
        status: error.status
      });

      let errorMessage = error.message;
      let errorCode = error.code;

      if (error.code === 'insufficient_quota') {
        errorMessage = 'OpenAI API quota exceeded. Please check your account.';
      } else if (error.status === 401) {
        errorMessage = 'Invalid OpenAI API key';
        errorCode = 'auth_error';
      }

      onEvent({
        type: 'error',
        error: errorMessage,
        code: errorCode
      });

      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  async visionCompletion<T = string>({
    prompt,
    imageBase64,
    messages = [],
    modelTier = 'medium',
    structuredOutput
  }: VisionCompletionParams<T>): Promise<T> {
    logger.debug('Starting vision completion', {
      promptLength: prompt.length,
      imageSize: imageBase64.length,
      messageCount: messages.length
    });

    const model = this.createModel(this.getModelForTier(modelTier));

    const contextMessages = this.convertToLangChainMessages(messages).filter(
      (message): message is HumanMessage | SystemMessage | AIMessage =>
        message instanceof HumanMessage || message instanceof SystemMessage || message instanceof AIMessage
    );

    const promptMessage = new HumanMessage({
      content: [
        {
          type: 'text',
          text: prompt
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${imageBase64}`
          }
        }
      ]
    });

    const allMessages: BaseMessage[] = [...contextMessages, promptMessage];

    if (structuredOutput) {
      const structuredModel = model.withStructuredOutput(structuredOutput as z.ZodTypeAny);
      const output = await structuredModel.invoke(allMessages);
      return output as T;
    }

    const response = await model.invoke(allMessages);
    const outputText = this.extractText(response);

    logger.debug('Vision completion received', {
      outputLength: outputText.length
    });

    return outputText as T;
  }

  private createModel(model: string, reasoningEffort?: 'none' | 'low' | 'medium' | 'high'): ChatOpenAI {
    const modelKwargs: Record<string, unknown> = {};
    if (model.includes('gpt-5') && reasoningEffort && reasoningEffort !== 'none') {
      modelKwargs.reasoning = {
        effort: this.getReasoningEffortForTier(reasoningEffort),
        summary: 'auto'
      };
    }

    return new ChatOpenAI({
      model,
      apiKey: this.apiKey,
      ...(Object.keys(modelKwargs).length > 0 ? { modelKwargs } : {})
    });
  }

  private extractText(message: { content: unknown }): string {
    if (typeof message.content === 'string') {
      return message.content;
    }

    if (!Array.isArray(message.content)) {
      return '';
    }

    return message.content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .join('');
  }

  private captureUsage(chunk: AIMessageChunk, onUsage: (inputTokens: number, outputTokens: number) => void): void {
    const usage = (chunk as any).usage_metadata || (chunk as any).response_metadata?.tokenUsage;

    const inputTokens = usage?.input_tokens ?? usage?.promptTokens;
    const outputTokens = usage?.output_tokens ?? usage?.completionTokens;

    if (typeof inputTokens === 'number' && typeof outputTokens === 'number') {
      onUsage(inputTokens, outputTokens);
    }
  }

  private getModelForTier(modelTier: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge'): string {
    switch (modelTier) {
      case 'tiny':
        return config.openai.models.tiny;
      case 'small':
        return config.openai.models.small;
      case 'medium':
        return config.openai.models.medium;
      case 'large':
        return config.openai.models.large;
      case 'xlarge':
        return config.openai.models.xlarge;
      default:
        return config.openai.models.small;
    }
  }

  private getReasoningEffortForTier(reasoningEffort: 'none' | 'low' | 'medium' | 'high'): string {
    switch (reasoningEffort) {
      case 'none':
        return 'minimal';
      case 'low':
        return 'low';
      case 'medium':
        return 'medium';
      case 'high':
        return 'high';
      default:
        return 'low';
    }
  }
}
