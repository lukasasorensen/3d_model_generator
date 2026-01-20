export interface ModelGenerationRequest {
  prompt?: string;
  format?: "stl" | "3mf";
  conversationId?: string;
  action?: "generate" | "finalize" | "reject_preview_and_retry";
}

export interface ModelGenerationResponse {
  id: string;
  prompt: string;
  scadCode: string;
  modelUrl: string;
  format: "stl" | "3mf";
  generatedAt: string;
  status: "pending" | "generating" | "completed" | "failed";
  error?: string;
}

export interface OpenSCADError {
  message: string;
  line?: number;
  column?: number;
}

// Conversation types
export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  scadCode?: string;
  modelUrl?: string;
  previewUrl?: string;
  format?: "stl" | "3mf";
  createdAt: string;
}

export interface Conversation {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface ConversationListItem {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}
