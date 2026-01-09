import { Router } from "express";
import { ConversationController } from "../controllers/conversationController";

export function createConversationRoutes(
  controller: ConversationController
): Router {
  const router = Router();

  // List all conversations
  router.get("/", (req, res) => controller.listConversations(req, res));

  // Get a specific conversation with messages
  router.get("/:id", (req, res) => controller.getConversation(req, res));

  // Create a new conversation with initial message (streaming)
  router.post("/", (req, res) => controller.createConversation(req, res));

  // Add a follow-up message to a conversation (streaming)
  router.post("/:id/messages/stream", (req, res) =>
    controller.addMessage(req, res)
  );

  // Delete a conversation
  router.delete("/:id", (req, res) => controller.deleteConversation(req, res));

  return router;
}
