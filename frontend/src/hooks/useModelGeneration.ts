import { useState } from "react";
import { apiClient, StreamEvent } from "../api/client";
import { ModelGenerationResponse } from "../types";

export interface StreamingState {
  status: "idle" | "generating" | "compiling" | "completed" | "error";
  streamingCode: string;
  streamingReasoning: string;
  statusMessage: string;
}

export function useModelGeneration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<ModelGenerationResponse | null>(null);
  const [streaming, setStreaming] = useState<StreamingState>({
    status: "idle",
    streamingCode: "",
    streamingReasoning: "",
    statusMessage: "",
  });

  const generateModel = async (
    prompt: string,
    format: "stl" | "3mf" = "stl"
  ) => {
    setLoading(true);
    setError(null);
    setModel(null);
    setStreaming({
      status: "idle",
      streamingCode: "",
      streamingReasoning: "",
      statusMessage: "",
    });

    try {
      await apiClient.generateModelStream(
        { prompt, format },
        (event: StreamEvent) => {
          switch (event.type) {
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
                streamingReasoning:
                  prev.streamingReasoning + (event.chunk || ""),
              }));
              break;

            case "tool_call_start":
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
              if (event.data && "scadCode" in event.data) {
                setModel(event.data as ModelGenerationResponse);
                setStreaming({
                  status: "completed",
                  streamingCode: (event.data as ModelGenerationResponse)
                    .scadCode,
                  streamingReasoning: "",
                  statusMessage: "Complete!",
                });
              }
              break;

            case "error":
            case "generation_error":
              throw new Error(event.error || "Stream error");
          }
        }
      );
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.message || "Failed to generate model";
      setError(errorMessage);
      setStreaming((prev) => ({
        ...prev,
        status: "error",
        statusMessage: errorMessage,
      }));
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);
  const clearModel = () => {
    setModel(null);
    setStreaming({
      status: "idle",
      streamingCode: "",
      streamingReasoning: "",
      statusMessage: "",
    });
  };

  return {
    generateModel,
    loading,
    error,
    model,
    streaming,
    clearError,
    clearModel,
  };
}
