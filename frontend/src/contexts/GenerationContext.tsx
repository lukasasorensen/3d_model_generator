/**
 * GenerationContext
 * Provides model generation state and operations to the component tree.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useStreamingState, StreamingState, ValidationPrompt } from '../hooks/useStreamingState';
import { useModelGeneration, OutputFormat } from '../hooks/useModelGeneration';
import { useConversationContext } from './ConversationContext';

interface GenerationContextValue {
  // State
  streaming: StreamingState;
  validationPrompt: ValidationPrompt | null;
  loading: boolean;
  error: string | null;
  // Operations
  addMessage: (prompt: string, format?: OutputFormat) => Promise<void>;
  approvePreview: (format?: OutputFormat) => Promise<void>;
  rejectPreview: (prompt: string) => Promise<void>;
  retryValidation: (reason: string, format?: OutputFormat) => Promise<void>;
  finalizeValidation: (format?: OutputFormat) => Promise<void>;
  clearError: () => void;
  resetStreaming: () => void;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

interface GenerationProviderProps {
  children: ReactNode;
}

export function GenerationProvider({ children }: GenerationProviderProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { activeConversation, setActiveConversation, fetchConversations } = useConversationContext();

  const {
    streaming,
    validationPrompt,
    resetStreaming,
    updateStreaming,
    appendCode,
    appendReasoning,
    setValidation,
    clearValidationPrompt
  } = useStreamingState();

  const {
    generateModel,
    approvePreview: approvePreviewBase,
    rejectPreview: rejectPreviewBase,
    retryValidation: retryValidationBase,
    finalizeValidation: finalizeValidationBase
  } = useModelGeneration({
    resetStreaming,
    updateStreaming,
    appendCode,
    appendReasoning,
    setValidation,
    clearValidationPrompt,
    activeConversation,
    setActiveConversation,
    refreshConversations: fetchConversations
  });

  const addMessage = useCallback(
    async (prompt: string, format: OutputFormat = 'stl') => {
      setLoading(true);
      setError(null);
      resetStreaming();
      clearValidationPrompt();

      const result = await generateModel(prompt, format, activeConversation?.id);

      if (result.error) {
        setError(result.error);
      }
      setLoading(false);
    },
    [activeConversation?.id, clearValidationPrompt, generateModel, resetStreaming]
  );

  const approvePreview = useCallback(
    async (format: OutputFormat = 'stl') => {
      setLoading(true);
      setError(null);

      const result = await approvePreviewBase(format);

      if (result.error) {
        setError(result.error);
      }
      setLoading(false);
    },
    [approvePreviewBase]
  );

  const rejectPreview = useCallback(
    async (prompt: string) => {
      setLoading(true);
      setError(null);

      const result = await rejectPreviewBase(prompt);

      if (result.error) {
        setError(result.error);
      }
      setLoading(false);
    },
    [rejectPreviewBase]
  );

  const retryValidation = useCallback(
    async (reason: string, format: OutputFormat = 'stl') => {
      setLoading(true);
      setError(null);

      const result = await retryValidationBase(reason, format);

      if (result.error) {
        setError(result.error);
      }
      setLoading(false);
    },
    [retryValidationBase]
  );

  const finalizeValidation = useCallback(
    async (format: OutputFormat = 'stl') => {
      setLoading(true);
      setError(null);

      const result = await finalizeValidationBase(format);

      if (result.error) {
        setError(result.error);
      }
      setLoading(false);
    },
    [finalizeValidationBase]
  );

  const clearError = useCallback(() => setError(null), []);

  const value: GenerationContextValue = {
    streaming,
    validationPrompt,
    loading,
    error,
    addMessage,
    approvePreview,
    rejectPreview,
    retryValidation,
    finalizeValidation,
    clearError,
    resetStreaming
  };

  return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>;
}

export function useGenerationContext(): GenerationContextValue {
  const context = useContext(GenerationContext);
  if (!context) {
    throw new Error('useGenerationContext must be used within a GenerationProvider');
  }
  return context;
}
