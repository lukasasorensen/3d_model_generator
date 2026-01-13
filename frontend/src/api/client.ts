import axios from "axios";
import {
  ModelGenerationRequest,
  ApiResponse,
  Conversation,
  ConversationListItem,
  Message,
} from "../types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

export interface ModelStreamEvent {
  type:
    | "generation_start"
    | "code_delta"
    | "reasoning_delta"
    | "tool_call_start"
    | "tool_call_delta"
    | "tool_call_end"
    | "code_complete"
    | "compiling"
    | "validating"
    | "completed"
    | "generation_error"
    | "error"
    | "conversation_created";
  message?: string;
  chunk?: string;
  code?: string;
  data?: { conversation: Conversation | null; message: Message };
  error?: string;
  conversationId?: string;
  previewUrl?: string;
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
 * Parse SSE events from a chunk of data.
 * Handles both named events (event: type\ndata: json) and simple data events (data: json with type inside)
 */
function parseSSEEvents(
  chunk: string
): Array<{ eventType: string; data: any }> {
  const events: Array<{ eventType: string; data: any }> = [];
  const lines = chunk.split("\n");

  let currentEventType: string | null = null;
  let currentData: string | null = null;

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      // Named event - store the event type
      currentEventType = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      // Data line
      currentData = line.slice(6);

      try {
        const parsedData = JSON.parse(currentData);

        // If we have a named event type, use it; otherwise fall back to type in data
        const eventType = currentEventType || parsedData.type;

        if (eventType) {
          events.push({
            eventType,
            data: parsedData,
          });
        }
      } catch (e) {
        // JSON parse error - skip this event
        if (!(e instanceof SyntaxError)) {
          throw e;
        }
      }

      // Reset for next event
      currentEventType = null;
      currentData = null;
    } else if (line === "") {
      // Empty line marks end of an event - reset state
      currentEventType = null;
      currentData = null;
    }
  }

  return events;
}

async function streamRequest(
  url: string,
  body: object,
  onEvent: (event: ModelStreamEvent) => void
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error("No response body");
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value);
      const events = parseSSEEvents(chunk);

        for (const { eventType, data } of events) {
          const event: ModelStreamEvent = {
            type: eventType as ModelStreamEvent["type"],
            ...data,
          };

        onEvent(event);

        if (event.type === "error" || event.type === "generation_error") {
          throw new Error(event.error || "Stream error");
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const apiClient = {
  async generateModelStream(
    request: ModelGenerationRequest,
    onEvent: (event: ModelStreamEvent) => void
  ): Promise<void> {
    await streamRequest(`${API_BASE_URL}/models/stream`, request, onEvent);
  },

  getModelUrl(id: string, format: "stl" | "3mf"): string {
    return `${API_BASE_URL}/models/${id}/${format}`;
  },

  // Conversation API methods
  async listConversations(): Promise<ConversationListItem[]> {
    const response = await axios.get<ApiResponse<ConversationListItem[]>>(
      `${API_BASE_URL}/conversations`
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to list conversations");
    }

    return response.data.data;
  },

  async getConversation(id: string): Promise<Conversation> {
    const response = await axios.get<ApiResponse<Conversation>>(
      `${API_BASE_URL}/conversations/${id}`
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get conversation");
    }

    return response.data.data;
  },

  async deleteConversation(id: string): Promise<void> {
    const response = await axios.delete<ApiResponse<void>>(
      `${API_BASE_URL}/conversations/${id}`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to delete conversation");
    }
  },
};
