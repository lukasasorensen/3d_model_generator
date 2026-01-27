import { PrismaClient } from '@prisma/client';
import { Conversation, ConversationListItem, Message } from '../../../shared/src/types/model';
import { logger } from '../infrastructure/logger/logger';

export class ConversationService {
  constructor(private prisma: PrismaClient) {
    logger.debug('ConversationService initialized');
  }

  async createConversation(title?: string): Promise<Conversation> {
    logger.debug('Creating new conversation', { title });
    const conversation = await this.prisma.conversation.create({
      data: {
        title
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    logger.info('Conversation created in database', {
      conversationId: conversation.id,
      title: conversation.title
    });
    return this.mapConversation(conversation);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    logger.debug('Fetching conversation from database', { conversationId: id });
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!conversation) {
      logger.debug('Conversation not found in database', {
        conversationId: id
      });
      return null;
    }

    logger.debug('Conversation fetched from database', {
      conversationId: id,
      messageCount: conversation.messages.length
    });
    return this.mapConversation(conversation);
  }

  async listConversations(): Promise<ConversationListItem[]> {
    logger.debug('Listing all conversations from database');
    const conversations = await this.prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true }
        }
      }
    });

    logger.debug('Conversations listed from database', {
      count: conversations.length
    });
    return conversations.map((conv: any) => ({
      id: conv.id,
      title: conv.title ?? undefined,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      messageCount: conv._count.messages
    }));
  }

  async deleteConversation(id: string): Promise<void> {
    logger.debug('Deleting conversation from database', { conversationId: id });
    await this.prisma.conversation.delete({
      where: { id }
    });
    logger.info('Conversation deleted from database', { conversationId: id });
  }

  async addUserMessage(conversationId: string, content: string): Promise<Message> {
    logger.debug('Adding user message to conversation', {
      conversationId,
      contentLength: content.length
    });
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content
      }
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    logger.info('User message added to database', {
      conversationId,
      messageId: message.id
    });
    return this.mapMessage(message);
  }

  async addAssistantMessage(
    conversationId: string,
    content: string,
    scadCode: string,
    modelUrl?: string,
    format?: 'stl' | '3mf',
    previewUrl?: string
  ): Promise<Message> {
    logger.debug('Adding assistant message to conversation', {
      conversationId,
      contentLength: content.length,
      codeLength: scadCode.length,
      modelUrl,
      format
    });
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content,
        scadCode,
        modelUrl,
        previewUrl,
        format
      }
    });

    // Update conversation timestamp and title if first message
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: true }
    });

    if (conversation && !conversation.title) {
      // Set title from first user message (truncated)
      const firstUserMessage = conversation.messages.find((m: any) => m.role === 'user');
      if (firstUserMessage) {
        const title =
          firstUserMessage.content.length > 50
            ? firstUserMessage.content.substring(0, 50) + '...'
            : firstUserMessage.content;
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { title }
        });
        logger.debug('Conversation title set from first user message', {
          conversationId,
          title
        });
      }
    }

    logger.info('Assistant message added to database', {
      conversationId,
      messageId: message.id,
      modelUrl
    });
    return this.mapMessage(message);
  }

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    logger.debug('Fetching messages for conversation', { conversationId });
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });

    logger.debug('Messages fetched from database', {
      conversationId,
      messageCount: messages.length
    });
    return messages.map(this.mapMessage);
  }

  private mapConversation(conv: any): Conversation {
    return {
      id: conv.id,
      title: conv.title ?? undefined,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      messages: conv.messages.map(this.mapMessage)
    };
  }

  private mapMessage(msg: any): Message {
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      scadCode: msg.scadCode ?? undefined,
      modelUrl: msg.modelUrl ?? undefined,
      previewUrl: msg.previewUrl ?? undefined,
      format: msg.format as 'stl' | '3mf' | undefined,
      createdAt: msg.createdAt.toISOString()
    };
  }
}
