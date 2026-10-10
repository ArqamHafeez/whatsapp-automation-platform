export type AiProviderName = 'openai' | 'openrouter' | 'mock' | 'ollama';

export function getAiConfig(): {
  provider: AiProviderName;
  openaiApiKey: string;
  openaiModel: string;
  openRouterApiKey: string;
  openRouterBaseUrl: string;
  openRouterModel: string;
  openRouterVisionModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  requestTimeoutMs: number;
  maxRetries: number;
  mockRelevant: boolean;
  mockRouteFirstOnly: boolean;
  mockNeedsReview: boolean;
  relevanceEscalationConfidence: number;
  openaiVisionModel: string;
  ollamaVisionModel: string;
} {
  const providerRaw = (process.env.AI_PROVIDER?.trim() || 'openai').toLowerCase();
  let provider: AiProviderName = 'openai';
  if (providerRaw === 'mock') {
    provider = 'mock';
  } else if (providerRaw === 'ollama') {
    provider = 'ollama';
  } else if (providerRaw === 'openrouter') {
    provider = 'openrouter';
  }

  const ollamaBaseUrl =
    process.env.OLLAMA_BASE_URL?.trim() ||
    process.env.OLLAMA_API_URL?.trim() ||
    'http://127.0.0.1:11434';

  return {
    provider,
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || '',
    openaiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
    openRouterApiKey: process.env.OPENROUTER_API_KEY?.trim() || '',
    openRouterBaseUrl: (process.env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
    openRouterModel: process.env.OPENROUTER_MODEL?.trim() || '',
    openRouterVisionModel: process.env.OPENROUTER_VISION_MODEL?.trim() || '',
    ollamaBaseUrl: ollamaBaseUrl.replace(/\/$/, ''),
    ollamaModel: process.env.OLLAMA_MODEL?.trim() || 'llama3.2',
    requestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS || 60_000),
    maxRetries: Number(process.env.AI_MAX_RETRIES || 2),
    mockRelevant: process.env.AI_MOCK_RELEVANT?.trim() !== 'false',
    mockRouteFirstOnly: process.env.AI_MOCK_ROUTE_FIRST_ONLY?.trim() === 'true',
    mockNeedsReview: process.env.AI_MOCK_NEEDS_REVIEW?.trim() === 'true',
    relevanceEscalationConfidence: Number(process.env.RELEVANCE_ESCALATION_CONFIDENCE || 0.75),
    openaiVisionModel: process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o-mini',
    ollamaVisionModel: process.env.OLLAMA_VISION_MODEL?.trim() || '',
  };
}
