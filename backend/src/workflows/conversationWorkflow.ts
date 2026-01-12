import { ConversationService } from "../services/conversationService";
import { logger } from "../infrastructure/logger/logger";

export class ConversationWorkflow {
  constructor(private conversationService: ConversationService) {
    logger.debug("ConversationWorkflow initialized");
  }

  async listConversations() {
    logger.info("Listing all conversations");
    const conversations = await this.conversationService.listConversations();
    logger.info("Conversations listed successfully", {
      count: conversations.length,
    });
    return conversations;
  }

  async getConversation(id: string) {
    logger.info("Getting conversation", { conversationId: id });
    const conversation = await this.conversationService.getConversation(id);
    if (!conversation) {
      logger.warn("Conversation not found", { conversationId: id });
      return null;
    }

    logger.info("Conversation retrieved successfully", {
      conversationId: id,
      messageCount: conversation.messages.length,
    });
    return conversation;
  }

  async deleteConversation(id: string): Promise<boolean> {
    logger.info("Deleting conversation", { conversationId: id });

    const conversation = await this.conversationService.getConversation(id);
    if (!conversation) {
      logger.warn("Conversation not found for deletion", { conversationId: id });
      return false;
    }

    await this.conversationService.deleteConversation(id);
    logger.info("Conversation deleted successfully", { conversationId: id });
    return true;
  }
}
