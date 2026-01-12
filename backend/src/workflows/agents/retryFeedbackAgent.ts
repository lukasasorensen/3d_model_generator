import { ConversationService } from "../../services/conversationService";

export class RetryFeedbackAgent {
  constructor(private conversationService: ConversationService) {}

  async recordFailure(
    conversationId: string,
    scadCode: string,
    format: "stl" | "3mf",
    errorMessage: string
  ): Promise<void> {
    await this.conversationService.addAssistantMessage(
      conversationId,
      "Generated OpenSCAD code (failed to compile).",
      scadCode,
      undefined,
      format
    );

    await this.conversationService.addUserMessage(
      conversationId,
      `The previous OpenSCAD code failed to compile. Error: ${errorMessage}. Please fix the code and return the complete updated OpenSCAD source.`
    );
  }
}
