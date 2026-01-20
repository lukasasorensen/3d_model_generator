/**
 * ConversationContext
 * Provides conversation state and operations to the component tree.
 */

import { createContext, useContext, useCallback, ReactNode } from "react";
import { useConversationList } from "../hooks/useConversationList";
import { useActiveConversation } from "../hooks/useActiveConversation";
import { Conversation, ConversationListItem } from "../types";

interface ConversationContextValue {
  // List state
  conversations: ConversationListItem[];
  listLoading: boolean;
  // Active conversation state
  activeConversation: Conversation | null;
  activeLoading: boolean;
  activeError: string | null;
  // Operations
  fetchConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;
  setActiveConversation: (conversation: Conversation | null) => void;
  refreshActiveConversation: () => Promise<void>;
  clearError: () => void;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

interface ConversationProviderProps {
  children: ReactNode;
}

export function ConversationProvider({ children }: ConversationProviderProps) {
  const {
    conversations,
    loading: listLoading,
    fetchConversations,
    deleteConversation: deleteFromList,
  } = useConversationList();

  const {
    activeConversation,
    loading: activeLoading,
    error: activeError,
    loadConversation,
    refreshActiveConversation,
    setActiveConversation,
    startNewConversation,
    clearError,
  } = useActiveConversation();

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      const success = await deleteFromList(id);
      if (success && activeConversation?.id === id) {
        startNewConversation();
      }
    },
    [activeConversation?.id, deleteFromList, startNewConversation]
  );

  const value: ConversationContextValue = {
    conversations,
    listLoading,
    activeConversation,
    activeLoading,
    activeError,
    fetchConversations,
    loadConversation,
    deleteConversation: handleDeleteConversation,
    startNewConversation,
    setActiveConversation,
    refreshActiveConversation,
    clearError,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversationContext(): ConversationContextValue {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error(
      "useConversationContext must be used within a ConversationProvider"
    );
  }
  return context;
}
