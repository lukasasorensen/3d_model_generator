/**
 * Streaming Service
 * Handles SSE streaming for model generation.
 */

import { ModelGenerationRequest, Conversation, Message } from '../types';
import { parseSSEEvents } from '../utils/sseParser';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export interface ModelStreamEvent {
  type:
    | 'generation_start'
    | 'code_delta'
    | 'reasoning_delta'
    | 'tool_call_start'
    | 'tool_call_delta'
    | 'tool_call_end'
    | 'code_complete'
    | 'compiling'
    | 'outputting'
    | 'preview_ready'
    | 'validating'
    | 'validation_failed'
    | 'completed'
    | 'generation_error'
    | 'error'
    | 'conversation_created';
  message?: string;
  chunk?: string;
  code?: string;
  data?: { conversation: Conversation | null; message: Message };
  error?: string;
  conversationId?: string;
  previewUrl?: string;
  fileId?: string;
  reason?: string;
  // Tool call fields
  toolCallId?: string;
  toolName?: string;
  argumentsDelta?: string;
  arguments?: string;
  // Usage stats
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Makes a streaming request and processes SSE events.
 */
async function streamRequest(
  url: string,
  body: object,
  onEvent: (event: ModelStreamEvent) => void
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('No response body');
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value);
      const events = parseSSEEvents(chunk);

      for (const { eventType, data } of events) {
        const event: ModelStreamEvent = {
          type: eventType as ModelStreamEvent['type'],
          ...data
        };

        onEvent(event);

        if (event.type === 'error' || event.type === 'generation_error') {
          throw new Error(event.error || 'Stream error');
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const streamingService = {
  /**
   * Streams model generation events.
   */
  async generateModelStream(
    request: ModelGenerationRequest,
    onEvent: (event: ModelStreamEvent) => void
  ): Promise<void> {
    await streamRequest(`${API_BASE_URL}/models/stream`, request, onEvent);
  },

  /**
   * Gets the URL for downloading a model file.
   */
  getModelUrl(id: string, format: 'stl' | '3mf'): string {
    return `${API_BASE_URL}/models/${id}/${format}`;
  }
};
