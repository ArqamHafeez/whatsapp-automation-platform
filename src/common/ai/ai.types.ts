export interface RelevanceAgentResult {
  relevant: boolean;
  reason: string;
  confidence: number;
  needsReview?: boolean;
  detectedWatermark?: boolean;
}

export interface RouteAgentResult {
  destinationChatIds: string[];
  reason: string;
  confidence: number;
}

export type AiTaskKind = 'relevance' | 'clean' | 'route';

export interface StructuredCompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  model?: string | null;
  schemaHint: string;
  taskKind?: AiTaskKind;
  /** Base64 data URL for vision tasks (images). */
  imageDataUrl?: string | null;
}

export interface StructuredCompletionResponse {
  rawText: string;
  parsed: Record<string, unknown>;
  model: string;
  provider: string;
}

export interface AgentRunContext {
  message: {
    body: string | null;
    type: string;
    sender: string;
    chatId: string;
    mediaUrl: string | null;
  };
  rule: {
    name: string;
    description: string | null;
  };
  sourceChat?: {
    title: string | null;
    description: string | null;
    externalChatId: string;
    type: string;
  };
  destinationChats?: Array<{
    id: string;
    title: string | null;
    description: string | null;
    externalChatId: string;
    type: string;
  }>;
}
