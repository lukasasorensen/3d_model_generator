/**
 * API Client
 * Re-exports services for backward compatibility.
 * New code should import from services directly.
 */

export { conversationService as apiClient } from '../services/conversationService';
export { streamingService } from '../services/streamingService';
export type { ModelStreamEvent } from '../services/streamingService';

// Re-export merged client for convenience
import { conversationService } from '../services/conversationService';
import { streamingService, ModelStreamEvent } from '../services/streamingService';
import { ModelGenerationRequest } from '../types';

/**
 * Combined API client for backward compatibility.
 * Prefer using individual services for new code.
 */
export const legacyApiClient = {
  // Conversation methods
  listConversations: conversationService.listConversations,
  getConversation: conversationService.getConversation,
  deleteConversation: conversationService.deleteConversation,

  // Streaming methods
  generateModelStream: (request: ModelGenerationRequest, onEvent: (event: ModelStreamEvent) => void) =>
    streamingService.generateModelStream(request, onEvent),

  getModelUrl: streamingService.getModelUrl
};
