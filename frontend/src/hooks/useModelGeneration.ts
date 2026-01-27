/**
 * useModelGeneration Hook
 * Coordinates model generation, approval, validation, and finalization workflows.
 */

import { useCallback, useRef } from 'react';
import { streamingService, ModelStreamEvent } from '../services/streamingService';
import { conversationService } from '../services/conversationService';
import { Conversation } from '../types';
import { StreamingState, ValidationPrompt } from './useStreamingState';

export type OutputFormat = 'stl' | '3mf';

interface UseModelGenerationOptions {
  // State updaters from useStreamingState
  resetStreaming: () => void;
  updateStreaming: (updates: Partial<StreamingState>) => void;
  appendCode: (chunk: string) => void;
  appendReasoning: (chunk: string) => void;
  setValidation: (prompt: ValidationPrompt | null) => void;
  clearValidationPrompt: () => void;
  // Active conversation management
  activeConversation: Conversation | null;
  setActiveConversation: (conversation: Conversation | null) => void;
  refreshConversations: () => Promise<void>;
}

export function useModelGeneration(options: UseModelGenerationOptions) {
  const {
    resetStreaming,
    updateStreaming,
    appendCode,
    appendReasoning,
    setValidation,
    clearValidationPrompt,
    activeConversation,
    setActiveConversation,
    refreshConversations
  } = options;

  const currentConversationIdRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  const handleStreamEvent = useCallback(
    (event: ModelStreamEvent) => {
      switch (event.type) {
        case 'conversation_created':
          if (event.conversationId) {
            currentConversationIdRef.current = event.conversationId;
          }
          if (currentConversationIdRef.current) {
            void conversationService
              .getConversation(currentConversationIdRef.current)
              .then(setActiveConversation)
              .catch(() => undefined);
          }
          break;

        case 'generation_start':
          if (currentConversationIdRef.current) {
            const shouldRefresh =
              !activeConversation || (event.message || '').toLowerCase().includes('retrying');
            if (shouldRefresh) {
              void conversationService
                .getConversation(currentConversationIdRef.current)
                .then(setActiveConversation)
                .catch(() => undefined);
            }
          }
          updateStreaming({
            status: 'generating',
            streamingCode: '',
            streamingReasoning: '',
            statusMessage: event.message || 'Starting...',
            previewUrl: undefined
          });
          break;

        case 'code_delta':
          appendCode(event.chunk || '');
          break;

        case 'reasoning_delta':
          appendReasoning(event.chunk || '');
          break;

        case 'tool_call_start':
          console.log('Tool call started:', event.toolName);
          break;

        case 'tool_call_delta':
          // Could be used to show tool call arguments streaming
          break;

        case 'tool_call_end':
          console.log('Tool call ended:', event.toolCallId);
          break;

        case 'code_complete':
          updateStreaming({
            streamingCode: event.code || '',
            statusMessage: 'Code generation complete'
          });
          break;

        case 'compiling':
          updateStreaming({
            status: 'compiling',
            statusMessage: event.message || 'Compiling...',
            previewUrl: undefined
          });
          break;

        case 'preview_ready':
          updateStreaming({
            status: 'awaiting_approval',
            statusMessage: event.message || 'Preview ready - awaiting approval',
            previewUrl: event.previewUrl,
            fileId: event.fileId
          });
          // Refresh conversation to get the saved preview message
          if (currentConversationIdRef.current) {
            void conversationService
              .getConversation(currentConversationIdRef.current)
              .then(setActiveConversation)
              .catch(() => undefined);
          }
          loadingRef.current = false;
          break;

        case 'validating':
          updateStreaming({
            status: 'validating',
            statusMessage: event.message || 'Validating...',
            previewUrl: event.previewUrl
          });
          break;

        case 'validation_failed':
          setValidation({
            reason: event.reason || 'Preview validation found issues.',
            previewUrl: event.previewUrl
          });
          updateStreaming({
            status: 'validating',
            statusMessage: event.message || 'Preview validation found issues.',
            previewUrl: event.previewUrl
          });
          break;

        case 'outputting':
          updateStreaming({
            status: 'compiling',
            statusMessage: event.message || 'Generating final model...'
          });
          break;

        case 'completed':
          if (event.data) {
            setActiveConversation(event.data.conversation);
            updateStreaming({
              status: 'completed',
              streamingCode: event.data.message.scadCode || '',
              streamingReasoning: '',
              statusMessage: 'Complete!',
              previewUrl: event.data.message.previewUrl
            });
            clearValidationPrompt();
          }
          break;

        case 'error':
        case 'generation_error':
          throw new Error(event.error || 'Stream error');
      }
    },
    [
      activeConversation,
      appendCode,
      appendReasoning,
      clearValidationPrompt,
      setActiveConversation,
      setValidation,
      updateStreaming
    ]
  );

  const generateModel = useCallback(
    async (
      prompt: string,
      format: OutputFormat = 'stl',
      conversationId?: string
    ): Promise<{ error?: string }> => {
      resetStreaming();
      clearValidationPrompt();
      currentConversationIdRef.current = conversationId || null;
      loadingRef.current = true;

      try {
        await streamingService.generateModelStream({ prompt, format, conversationId }, handleStreamEvent);
        await refreshConversations();
        return {};
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate model';
        updateStreaming({
          status: 'error',
          statusMessage: errorMessage
        });
        // Try to load conversation state on error
        if (currentConversationIdRef.current) {
          try {
            const conversation = await conversationService.getConversation(currentConversationIdRef.current);
            setActiveConversation(conversation);
          } catch {
            // Ignore load errors on failure paths
          }
        }
        return { error: errorMessage };
      } finally {
        loadingRef.current = false;
      }
    },
    [
      clearValidationPrompt,
      handleStreamEvent,
      refreshConversations,
      resetStreaming,
      setActiveConversation,
      updateStreaming
    ]
  );

  const approvePreview = useCallback(
    async (format: OutputFormat = 'stl'): Promise<{ error?: string }> => {
      if (!activeConversation) {
        return { error: 'No active conversation' };
      }

      updateStreaming({
        status: 'compiling',
        statusMessage: 'Generating final model...'
      });
      currentConversationIdRef.current = activeConversation.id;
      loadingRef.current = true;

      try {
        await streamingService.generateModelStream(
          { conversationId: activeConversation.id, format, action: 'finalize' },
          handleStreamEvent
        );
        await refreshConversations();
        return {};
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to finalize model';
        updateStreaming({
          status: 'error',
          statusMessage: errorMessage
        });
        return { error: errorMessage };
      } finally {
        loadingRef.current = false;
      }
    },
    [activeConversation, handleStreamEvent, refreshConversations, updateStreaming]
  );

  const rejectPreview = useCallback(
    async (prompt: string): Promise<{ error?: string }> => {
      if (!activeConversation) {
        return { error: 'No active conversation' };
      }

      updateStreaming({
        status: 'validating',
        statusMessage: 'Analyzing preview with AI...'
      });
      currentConversationIdRef.current = activeConversation.id;
      loadingRef.current = true;

      try {
        await streamingService.generateModelStream(
          { conversationId: activeConversation.id, prompt, action: 'reject_preview_and_retry' },
          handleStreamEvent
        );
        await refreshConversations();
        return {};
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to validate model';
        updateStreaming({
          status: 'error',
          statusMessage: errorMessage
        });
        return { error: errorMessage };
      } finally {
        loadingRef.current = false;
      }
    },
    [activeConversation, handleStreamEvent, refreshConversations, updateStreaming]
  );

  const retryValidation = useCallback(
    async (reason: string, format: OutputFormat = 'stl'): Promise<{ error?: string }> => {
      clearValidationPrompt();
      const retryPrompt = `The preview image does not match the request. Issues: ${reason}. Please fix the code and return the complete updated OpenSCAD source.`;

      if (!activeConversation) {
        return generateModel(retryPrompt, format);
      }
      return generateModel(retryPrompt, format, activeConversation.id);
    },
    [activeConversation, clearValidationPrompt, generateModel]
  );

  const finalizeValidation = useCallback(
    async (format: OutputFormat = 'stl'): Promise<{ error?: string }> => {
      if (!activeConversation) {
        return { error: 'No active conversation' };
      }

      clearValidationPrompt();
      updateStreaming({
        status: 'compiling',
        streamingCode: '',
        streamingReasoning: '',
        statusMessage: 'Generating final model...'
      });
      currentConversationIdRef.current = activeConversation.id;
      loadingRef.current = true;

      try {
        await streamingService.generateModelStream(
          { conversationId: activeConversation.id, format, action: 'finalize' },
          handleStreamEvent
        );
        await refreshConversations();
        return {};
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to finalize model';
        updateStreaming({
          status: 'error',
          statusMessage: errorMessage
        });
        return { error: errorMessage };
      } finally {
        loadingRef.current = false;
      }
    },
    [activeConversation, clearValidationPrompt, handleStreamEvent, refreshConversations, updateStreaming]
  );

  return {
    generateModel,
    approvePreview,
    rejectPreview,
    retryValidation,
    finalizeValidation
  };
}
