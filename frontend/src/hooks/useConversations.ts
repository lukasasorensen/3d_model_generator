import { useState, useCallback, useRef } from "react";
import { apiClient, ModelStreamEvent } from "../api/client";
import { Conversation, ConversationListItem } from "../types";

export interface StreamingState {
  status:
    | "idle"
    | "generating"
    | "compiling"
    | "validating"
    | "completed"
    | "error";
  streamingCode: string;
  streamingReasoning: string;
  statusMessage: string;
  previewUrl?: string;
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
  const [validationPrompt, setValidationPrompt] = useState<{
    reason: string;
    previewUrl?: string;
  } | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await apiClient.listConversations();
      setConversations(data);
    } catch (err: any) {
      console.error("Failed to fetch conversations:", err);
    }
  }, [activeConversation]);

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
      setValidationPrompt(null);
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
      setValidationPrompt(null);
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
        if (currentConversationIdRef.current) {
          void apiClient
            .getConversation(currentConversationIdRef.current)
            .then(setActiveConversation)
            .catch(() => undefined);
        }
        // Conversation created, waiting for generation
        break;

      case "generation_start":
        if (currentConversationIdRef.current) {
          const shouldRefresh =
            !activeConversation ||
            (event.message || "").toLowerCase().includes("retrying");
          if (shouldRefresh) {
            void apiClient
              .getConversation(currentConversationIdRef.current)
              .then(setActiveConversation)
              .catch(() => undefined);
          }
        }
        setStreaming({
          status: "generating",
          streamingCode: "",
          streamingReasoning: "",
          statusMessage: event.message || "Starting...",
          previewUrl: undefined,
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
          previewUrl: undefined,
        }));
        break;

      case "validating":
        setStreaming((prev) => ({
          ...prev,
          status: "validating",
          statusMessage: event.message || "Validating...",
          previewUrl: event.previewUrl,
        }));
        break;

      case "validation_failed":
        setValidationPrompt({
          reason: event.reason || "Preview validation found issues.",
          previewUrl: event.previewUrl,
        });
        setStreaming((prev) => ({
          ...prev,
          status: "validating",
          statusMessage: event.message || "Preview validation found issues.",
          previewUrl: event.previewUrl || prev.previewUrl,
        }));
        break;

      case "outputting":
        setStreaming((prev) => ({
          ...prev,
          status: "compiling",
          statusMessage: event.message || "Generating final model...",
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
            previewUrl: event.data.message.previewUrl,
          });
          setValidationPrompt(null);
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
  const clearValidationPrompt = useCallback(
    () => setValidationPrompt(null),
    []
  );

  const retryValidation = useCallback(
    async (reason: string, format: "stl" | "3mf" = "stl") => {
      setValidationPrompt(null);
      await addMessage(
        `The preview image does not match the request. Issues: ${reason}. Please fix the code and return the complete updated OpenSCAD source.`,
        format
      );
    },
    [addMessage]
  );

  const finalizeValidation = useCallback(
    async (format: "stl" | "3mf" = "stl") => {
      if (!activeConversation) {
        return;
      }
      setValidationPrompt(null);
      setLoading(true);
      setStreaming({
        status: "compiling",
        streamingCode: "",
        streamingReasoning: "",
        statusMessage: "Generating final model...",
      });
      currentConversationIdRef.current = activeConversation.id;
      try {
        await apiClient.generateModelStream(
          { conversationId: activeConversation.id, format, action: "finalize" },
          (event: ModelStreamEvent) => {
            handleStreamEvent(event);
          }
        );
        await fetchConversations();
      } catch (err: any) {
        const errorMessage = err.message || "Failed to finalize model";
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
    [activeConversation, fetchConversations, handleStreamEvent]
  );

  return {
    conversations,
    activeConversation,
    loading,
    error,
    streaming,
    validationPrompt,
    fetchConversations,
    loadConversation,
    startNewConversation,
    createConversation,
    addMessage,
    deleteConversation,
    clearError,
    clearValidationPrompt,
    retryValidation,
    finalizeValidation,
  };
}
