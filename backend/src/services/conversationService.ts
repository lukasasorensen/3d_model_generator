import { PrismaClient } from "@prisma/client";
import {
  Conversation,
  ConversationListItem,
  Message,
} from "../../../shared/src/types/model";

export class ConversationService {
  constructor(private prisma: PrismaClient) {}

  async createConversation(title?: string): Promise<Conversation> {
    const conversation = await this.prisma.conversation.create({
      data: {
        title,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return this.mapConversation(conversation);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) return null;
    return this.mapConversation(conversation);
  }

  async listConversations(): Promise<ConversationListItem[]> {
    const conversations = await this.prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return conversations.map((conv: any) => ({
      id: conv.id,
      title: conv.title ?? undefined,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      messageCount: conv._count.messages,
    }));
  }

  async deleteConversation(id: string): Promise<void> {
    await this.prisma.conversation.delete({
      where: { id },
    });
  }

  async addUserMessage(
    conversationId: string,
    content: string
  ): Promise<Message> {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: "user",
        content,
      },
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return this.mapMessage(message);
  }

  async addAssistantMessage(
    conversationId: string,
    content: string,
    scadCode: string,
    modelUrl: string,
    format: "stl" | "3mf"
  ): Promise<Message> {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: "assistant",
        content,
        scadCode,
        modelUrl,
        format,
      },
    });

    // Update conversation timestamp and title if first message
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: true },
    });

    if (conversation && !conversation.title) {
      // Set title from first user message (truncated)
      const firstUserMessage = conversation.messages.find(
        (m: Message) => m.role === "user"
      );
      if (firstUserMessage) {
        const title =
          firstUserMessage.content.length > 50
            ? firstUserMessage.content.substring(0, 50) + "..."
            : firstUserMessage.content;
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { title },
        });
      }
    }

    return this.mapMessage(message);
  }

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    return messages.map(this.mapMessage);
  }

  private mapConversation(conv: any): Conversation {
    return {
      id: conv.id,
      title: conv.title ?? undefined,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      messages: conv.messages.map(this.mapMessage),
    };
  }

  private mapMessage(msg: any): Message {
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      role: msg.role as "user" | "assistant",
      content: msg.content,
      scadCode: msg.scadCode ?? undefined,
      modelUrl: msg.modelUrl ?? undefined,
      format: msg.format as "stl" | "3mf" | undefined,
      createdAt: msg.createdAt.toISOString(),
    };
  }
}
