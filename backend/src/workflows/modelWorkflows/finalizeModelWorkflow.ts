import { Response } from 'express';
import { OpenSCADService } from '../../services/openscadService';
import { FileStorageService } from '../../services/fileStorageService';
import { ConversationService } from '../../services/conversationService';
import { SSE_EVENTS, writeSse } from '../../utils/sseUtils';
import { AiClient } from '../../clients/aiClient';
import { ModelWorkflow } from './modelWorkflow';

export class FinalizeModelWorkflow extends ModelWorkflow {
  constructor(
    conversationService: ConversationService,
    openscadService: OpenSCADService,
    fileStorage: FileStorageService,
    aiClient: AiClient
  ) {
    super(conversationService, openscadService, fileStorage, aiClient);
  }

  async getConversation(conversationId: string) {
    return super.getConversation(conversationId);
  }

  async finalizeModelStream(res: Response, conversationId: string, format: 'stl' | '3mf'): Promise<void> {
    const conversation = await this.conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const lastAssistant = [...conversation.messages]
      .reverse()
      .find((msg) => msg.role === 'assistant' && msg.scadCode);

    if (!lastAssistant?.scadCode) {
      throw new Error('No generated code available to finalize');
    }

    const { id: fileId, filePath: scadPath } = await this.fileStorage.saveScadFile(lastAssistant.scadCode);

    writeSse(res, SSE_EVENTS.outputting, {
      message: 'Generating final model...'
    });

    const output = await this.openscadService.generateOutput(scadPath, fileId, format);

    const assistantMessage = await this.conversationService.addAssistantMessage(
      conversationId,
      'Generated final model.',
      lastAssistant.scadCode,
      output.modelUrl,
      format,
      lastAssistant.previewUrl
    );

    const updatedConversation = await this.conversationService.getConversation(conversationId);

    writeSse(res, SSE_EVENTS.completed, {
      data: {
        conversation: updatedConversation,
        message: assistantMessage
      }
    });
  }
}
