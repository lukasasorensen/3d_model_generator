import { useState, useCallback, useRef } from "react";
import { apiClient, ModelStreamEvent } from "../api/client";
import { Conversation, ConversationListItem } from "../types";

export interface StreamingState {
  status: "idle" | "generating" | "compiling" | "completed" | "error";
  streamingCode: string;
  streamingReasoning: string;
  statusMessage: string;
}

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    []
  );
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<StreamingState>({
    status: "idle",
    streamingCode: "",
    streamingReasoning: "",
    statusMessage: "",
  });
  const currentConversationIdRef = useRef<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await apiClient.listConversations();
      setConversations(data);
    } catch (err: any) {
      console.error("Failed to fetch conversations:", err);
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const conversation = await apiClient.getConversation(id);
      setActiveConversation(conversation);
      setStreaming({
        status: "idle",
        streamingCode: "",
        streamingReasoning: "",
        statusMessage: "",
      });
    } catch (err: any) {
      setError(err.message || "Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }, []);

  const startNewConversation = useCallback(() => {
    setActiveConversation(null);
    setStreaming({
      status: "idle",
      streamingCode: "",
      streamingReasoning: "",
      statusMessage: "",
    });
    setError(null);
  }, []);

  const createConversation = useCallback(
    async (prompt: string, format: "stl" | "3mf" = "stl") => {
      setLoading(true);
      setError(null);
      setStreaming({
        status: "idle",
        streamingCode: "",
        streamingReasoning: "",
        statusMessage: "",
      });

      try {
        currentConversationIdRef.current = null;
        await apiClient.generateModelStream(
          { prompt, format },
          (event: ModelStreamEvent) => {
            handleStreamEvent(event);
          }
        );
        // Refresh conversation list
        await fetchConversations();
      } catch (err: any) {
        const errorMessage = err.message || "Failed to create conversation";
        setError(errorMessage);
        setStreaming((prev) => ({
          ...prev,
          status: "error",
          statusMessage: errorMessage,
        }));
        if (currentConversationIdRef.current) {
          try {
            const conversation = await apiClient.getConversation(
              currentConversationIdRef.current
            );
            setActiveConversation(conversation);
          } catch {
            // Ignore load errors on failure paths
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [fetchConversations]
  );

  const addMessage = useCallback(
    async (prompt: string, format: "stl" | "3mf" = "stl") => {
      if (!activeConversation) {
        // If no active conversation, create a new one
        await createConversation(prompt, format);
        return;
      }

      setLoading(true);
      setError(null);
      currentConversationIdRef.current = activeConversation.id;
      setStreaming({
        status: "idle",
        streamingCode: "",
        streamingReasoning: "",
        statusMessage: "",
      });

      try {
        await apiClient.generateModelStream(
          { prompt, format, conversationId: activeConversation.id },
          (event: ModelStreamEvent) => {
            handleStreamEvent(event);
          }
        );
        // Refresh conversation list
        await fetchConversations();
      } catch (err: any) {
        const errorMessage = err.message || "Failed to add message";
        setError(errorMessage);
        setStreaming((prev) => ({
          ...prev,
          status: "error",
          statusMessage: errorMessage,
        }));
        if (currentConversationIdRef.current) {
          try {
            const conversation = await apiClient.getConversation(
              currentConversationIdRef.current
            );
            setActiveConversation(conversation);
          } catch {
            // Ignore load errors on failure paths
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [activeConversation, createConversation, fetchConversations]
  );

  const handleStreamEvent = useCallback((event: ModelStreamEvent) => {
    switch (event.type) {
      case "conversation_created":
        if (event.conversationId) {
          currentConversationIdRef.current = event.conversationId;
        }
        // Conversation created, waiting for generation
        break;

      case "generation_start":
        setStreaming({
          status: "generating",
          streamingCode: "",
          streamingReasoning: "",
          statusMessage: event.message || "Starting...",
        });
        break;

      case "code_delta":
        setStreaming((prev) => ({
          ...prev,
          streamingCode: prev.streamingCode + (event.chunk || ""),
        }));
        break;

      case "reasoning_delta":
        setStreaming((prev) => ({
          ...prev,
          streamingReasoning: prev.streamingReasoning + (event.chunk || ""),
        }));
        break;

      case "tool_call_start":
        // Could be used to show tool call UI in the future
        console.log("Tool call started:", event.toolName);
        break;

      case "tool_call_delta":
        // Could be used to show tool call arguments streaming
        break;

      case "tool_call_end":
        console.log("Tool call ended:", event.toolCallId);
        break;

      case "code_complete":
        setStreaming((prev) => ({
          ...prev,
          streamingCode: event.code || prev.streamingCode,
          statusMessage: "Code generation complete",
        }));
        break;

      case "compiling":
        setStreaming((prev) => ({
          ...prev,
          status: "compiling",
          statusMessage: event.message || "Compiling...",
        }));
        break;

      case "completed":
        if (event.data) {
          setActiveConversation(event.data.conversation);
          setStreaming({
            status: "completed",
            streamingCode: event.data.message.scadCode || "",
            streamingReasoning: "",
            statusMessage: "Complete!",
          });
        }
        break;

      case "error":
      case "generation_error":
        throw new Error(event.error || "Stream error");
    }
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await apiClient.deleteConversation(id);
        await fetchConversations();
        if (activeConversation?.id === id) {
          setActiveConversation(null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to delete conversation");
      }
    },
    [activeConversation, fetchConversations]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    conversations,
    activeConversation,
    loading,
    error,
    streaming,
    fetchConversations,
    loadConversation,
    startNewConversation,
    createConversation,
    addMessage,
    deleteConversation,
    clearError,
  };
}
