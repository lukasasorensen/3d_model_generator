import { Request, Response } from 'express';
import { logger } from '../infrastructure/logger/logger';
import { ConversationService } from '../services/conversationService';

export class ConversationController {
  constructor(private conversationService: ConversationService) {
    logger.debug('ConversationController initialized');
  }

  async listConversations(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Listing all conversations');
      const conversations = await this.conversationService.listConversations();
      logger.info('Conversations listed successfully', {
        count: conversations.length
      });
      res.json({
        success: true,
        data: conversations
      });
    } catch (error: any) {
      logger.error('Error listing conversations', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to list conversations'
      });
    }
  }

  async getConversation(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      logger.info('Getting conversation', { conversationId: id });
      const conversation = await this.conversationService.getConversation(id);
      if (!conversation) {
        logger.warn('Conversation not found', { conversationId: id });
        res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
        return;
      }

      logger.info('Conversation retrieved successfully', {
        conversationId: id,
        messageCount: conversation.messages.length
      });
      res.json({
        success: true,
        data: conversation
      });
    } catch (error: any) {
      logger.error('Error getting conversation', {
        conversationId: id,
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get conversation'
      });
    }
  }

  async deleteConversation(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      logger.info('Deleting conversation', { conversationId: id });
      const conversation = await this.conversationService.getConversation(id);
      if (!conversation) {
        logger.warn('Conversation not found for deletion', { conversationId: id });
        res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
        return;
      }

      await this.conversationService.deleteConversation(id);
      logger.info('Conversation deleted successfully', { conversationId: id });
      res.json({
        success: true,
        message: 'Conversation deleted'
      });
    } catch (error: any) {
      logger.error('Error deleting conversation', {
        conversationId: id,
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete conversation'
      });
    }
  }
}
