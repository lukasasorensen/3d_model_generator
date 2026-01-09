import axios from "axios";
import {
  ModelGenerationRequest,
  ModelGenerationResponse,
  ApiResponse,
  Conversation,
  ConversationListItem,
  Message,
  CreateConversationRequest,
  AddMessageRequest,
} from "../types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

export interface StreamEvent {
  type:
    | "start"
    | "code_chunk"
    | "code_complete"
    | "compiling"
    | "completed"
    | "error"
    | "conversation_created";
  message?: string;
  chunk?: string;
  code?: string;
  data?:
    | ModelGenerationResponse
    | { conversation: Conversation; message: Message };
  error?: string;
  conversationId?: string;
}

export interface ConversationStreamEvent {
  type:
    | "conversation_created"
    | "start"
    | "code_chunk"
    | "code_complete"
    | "compiling"
    | "completed"
    | "error";
  message?: string;
  chunk?: string;
  code?: string;
  data?: {
    conversation: Conversation;
    message: Message;
  };
  error?: string;
  conversationId?: string;
}

async function streamRequest(
  url: string,
  body: object,
  onEvent: (event: ConversationStreamEvent) => void
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
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data) as ConversationStreamEvent;
            onEvent(event);

            if (event.type === "error") {
              throw new Error(event.error || "Stream error");
            }
          } catch (e) {
            if (e instanceof SyntaxError) {
              continue;
            }
            throw e;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const apiClient = {
  // Legacy model generation (without conversation)
  async generateModelStream(
    request: ModelGenerationRequest,
    onEvent: (event: StreamEvent) => void
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/models/generate/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
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
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data) as StreamEvent;
              onEvent(event);

              if (event.type === "error") {
                throw new Error(event.error || "Stream error");
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                continue;
              }
              throw e;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  async generateModel(
    request: ModelGenerationRequest
  ): Promise<ModelGenerationResponse> {
    const response = await axios.post<ApiResponse<ModelGenerationResponse>>(
      `${API_BASE_URL}/models/generate`,
      request
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to generate model");
    }

    return response.data.data;
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

  async createConversation(
    request: CreateConversationRequest,
    onEvent: (event: ConversationStreamEvent) => void
  ): Promise<void> {
    await streamRequest(`${API_BASE_URL}/conversations`, request, onEvent);
  },

  async addMessage(
    conversationId: string,
    request: AddMessageRequest,
    onEvent: (event: ConversationStreamEvent) => void
  ): Promise<void> {
    await streamRequest(
      `${API_BASE_URL}/conversations/${conversationId}/messages/stream`,
      request,
      onEvent
    );
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
