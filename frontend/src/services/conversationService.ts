/**
 * Conversation Service
 * Handles all conversation-related API operations.
 */

import axios from 'axios';
import { ApiResponse, Conversation, ConversationListItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export const conversationService = {
  /**
   * Fetches the list of all conversations.
   */
  async listConversations(): Promise<ConversationListItem[]> {
    const response = await axios.get<ApiResponse<ConversationListItem[]>>(`${API_BASE_URL}/conversations`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to list conversations');
    }

    return response.data.data;
  },

  /**
   * Fetches a single conversation by ID with all messages.
   */
  async getConversation(id: string): Promise<Conversation> {
    const response = await axios.get<ApiResponse<Conversation>>(`${API_BASE_URL}/conversations/${id}`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get conversation');
    }

    return response.data.data;
  },

  /**
   * Deletes a conversation by ID.
   */
  async deleteConversation(id: string): Promise<void> {
    const response = await axios.delete<ApiResponse<void>>(`${API_BASE_URL}/conversations/${id}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete conversation');
    }
  }
};
