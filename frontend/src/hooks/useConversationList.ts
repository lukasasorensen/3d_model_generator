/**
 * useConversationList Hook
 * Manages the list of conversations and CRUD operations.
 */

import { useState, useCallback } from "react";
import { conversationService } from "../services/conversationService";
import { ConversationListItem } from "../types";

export function useConversationList() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await conversationService.listConversations();
      setConversations(data);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteConversation = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await conversationService.deleteConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        return true;
      } catch (err) {
        console.error("Failed to delete conversation:", err);
        return false;
      }
    },
    []
  );

  return {
    conversations,
    loading,
    fetchConversations,
    deleteConversation,
  };
}
