/**
 * useActiveConversation Hook
 * Manages the currently active/selected conversation.
 */

import { useState, useCallback } from "react";
import { conversationService } from "../services/conversationService";
import { Conversation } from "../types";

export function useActiveConversation() {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversation = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const conversation = await conversationService.getConversation(id);
      setActiveConversation(conversation);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load conversation";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshActiveConversation = useCallback(async () => {
    if (!activeConversation) return;
    try {
      const conversation = await conversationService.getConversation(activeConversation.id);
      setActiveConversation(conversation);
    } catch {
      // Silently fail on refresh
    }
  }, [activeConversation]);

  const startNewConversation = useCallback(() => {
    setActiveConversation(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    activeConversation,
    loading,
    error,
    loadConversation,
    refreshActiveConversation,
    setActiveConversation,
    startNewConversation,
    clearError,
  };
}
