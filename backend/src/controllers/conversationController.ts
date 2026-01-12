import { Request, Response } from "express";
import { logger } from "../infrastructure/logger/logger";
import { ConversationWorkflow } from "../workflows/conversationWorkflow";

export class ConversationController {
  constructor(private conversationWorkflow: ConversationWorkflow) {
    logger.debug("ConversationController initialized");
  }

  async listConversations(req: Request, res: Response): Promise<void> {
    try {
      const conversations = await this.conversationWorkflow.listConversations();
      res.json({
        success: true,
        data: conversations,
      });
    } catch (error: any) {
      logger.error("Error listing conversations", {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list conversations",
      });
    }
  }

  async getConversation(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const conversation = await this.conversationWorkflow.getConversation(id);
      if (!conversation) {
        res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
        return;
      }

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error: any) {
      logger.error("Error getting conversation", {
        conversationId: id,
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get conversation",
      });
    }
  }

  async deleteConversation(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const deleted = await this.conversationWorkflow.deleteConversation(id);
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
        return;
      }

      res.json({
        success: true,
        message: "Conversation deleted",
      });
    } catch (error: any) {
      logger.error("Error deleting conversation", {
        conversationId: id,
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete conversation",
      });
    }
  }
}
