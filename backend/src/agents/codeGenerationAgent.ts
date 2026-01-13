import {
  OpenScadAiService,
  OpenScadStreamEvent,
} from "../services/openScadAiService";
import { Message } from "../../../shared/src/types/model";

export class CodeGenerationAgent {
  constructor(private openScadAiService: OpenScadAiService) {}

  async generateCode(
    messages: Message[],
    onEvent: (event: OpenScadStreamEvent) => void
  ): Promise<string> {
    return this.openScadAiService.generateCode(messages, onEvent);
  }
}
