import { useState, useCallback } from "react";
import { apiClient, ConversationStreamEvent } from "../api/client";
import { Conversation, ConversationListItem, Message } from "../types";

export interface StreamingState {
  status: "idle" | "generating" | "compiling" | "completed" | "error";
  streamingCode: string;
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
    statusMessage: "",
  });

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
        statusMessage: "",
      });

      try {
        await apiClient.createConversation(
          { prompt, format },
          (event: ConversationStreamEvent) => {
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
      setStreaming({
        status: "idle",
        streamingCode: "",
        statusMessage: "",
      });

      try {
        await apiClient.addMessage(
          activeConversation.id,
          { prompt, format },
          (event: ConversationStreamEvent) => {
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
      } finally {
        setLoading(false);
      }
    },
    [activeConversation, createConversation, fetchConversations]
  );

  const handleStreamEvent = useCallback((event: ConversationStreamEvent) => {
    switch (event.type) {
      case "conversation_created":
        // Conversation created, waiting for generation
        break;

      case "start":
        setStreaming({
          status: "generating",
          streamingCode: "",
          statusMessage: event.message || "Starting...",
        });
        break;

      case "code_chunk":
        setStreaming((prev) => ({
          ...prev,
          streamingCode: prev.streamingCode + (event.chunk || ""),
        }));
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
            statusMessage: "Complete!",
          });
        }
        break;

      case "error":
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
