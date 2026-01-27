/**
 * useStreamingState Hook
 * Manages the streaming/generation state for model generation.
 */

import { useState, useCallback } from 'react';

export interface StreamingState {
  status: 'idle' | 'generating' | 'compiling' | 'awaiting_approval' | 'validating' | 'completed' | 'error';
  streamingCode: string;
  streamingReasoning: string;
  statusMessage: string;
  previewUrl?: string;
  fileId?: string;
}

export interface ValidationPrompt {
  reason: string;
  previewUrl?: string;
}

const INITIAL_STREAMING_STATE: StreamingState = {
  status: 'idle',
  streamingCode: '',
  streamingReasoning: '',
  statusMessage: ''
};

export function useStreamingState() {
  const [streaming, setStreaming] = useState<StreamingState>(INITIAL_STREAMING_STATE);
  const [validationPrompt, setValidationPrompt] = useState<ValidationPrompt | null>(null);

  const resetStreaming = useCallback(() => {
    setStreaming(INITIAL_STREAMING_STATE);
  }, []);

  const updateStreaming = useCallback((updates: Partial<StreamingState>) => {
    setStreaming((prev) => ({ ...prev, ...updates }));
  }, []);

  const appendCode = useCallback((chunk: string) => {
    setStreaming((prev) => ({
      ...prev,
      streamingCode: prev.streamingCode + chunk
    }));
  }, []);

  const appendReasoning = useCallback((chunk: string) => {
    setStreaming((prev) => ({
      ...prev,
      streamingReasoning: prev.streamingReasoning + chunk
    }));
  }, []);

  const setValidation = useCallback((prompt: ValidationPrompt | null) => {
    setValidationPrompt(prompt);
  }, []);

  const clearValidationPrompt = useCallback(() => {
    setValidationPrompt(null);
  }, []);

  return {
    streaming,
    validationPrompt,
    resetStreaming,
    updateStreaming,
    appendCode,
    appendReasoning,
    setValidation,
    clearValidationPrompt
  };
}
