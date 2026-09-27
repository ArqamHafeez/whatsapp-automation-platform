import { Logger } from '@nestjs/common';
import { getAiConfig } from './ai.config';
import { AGENT_JSON_REQUIREMENTS, extractJsonObject } from './agent-json';
import { StructuredCompletionRequest, StructuredCompletionResponse } from './ai.types';

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export interface AiProvider {
  completeStructured(request: StructuredCompletionRequest): Promise<StructuredCompletionResponse>;
}

function parseJsonCompletion(rawText: string, providerLabel: string): Record<string, unknown> {
  try {
    return extractJsonObject(rawText);
  } catch {
    throw new AiProviderError(`${providerLabel} returned non-JSON content`);
  }
}

function buildStructuredSystemPrompt(systemPrompt: string, schemaHint: string): string {
  return `${systemPrompt}\n\n${AGENT_JSON_REQUIREMENTS}\n\nReturn JSON matching this schema:\n${schemaHint}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenAiProvider implements AiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);

  async completeStructured(request: StructuredCompletionRequest): Promise<StructuredCompletionResponse> {
    const { openaiApiKey, openaiModel, openaiVisionModel, requestTimeoutMs, maxRetries } = getAiConfig();
    if (!openaiApiKey) {
      throw new AiProviderError('OPENAI_API_KEY is not configured');
    }

    const model =
      request.imageDataUrl?.startsWith('data:image/')
        ? request.model?.trim() || openaiVisionModel
        : request.model?.trim() || openaiModel;
    const userContent: unknown = request.imageDataUrl?.startsWith('data:image/')
      ? [
          { type: 'text', text: request.userPrompt },
          { type: 'image_url', image_url: { url: request.imageDataUrl } },
        ]
      : request.userPrompt;

    const body = {
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: buildStructuredSystemPrompt(request.systemPrompt, request.schemaHint),
        },
        { role: 'user', content: userContent },
      ],
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(requestTimeoutMs),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new AiProviderError(
            `OpenAI HTTP ${res.status}: ${errorText.slice(0, 300)}`,
            res.status,
          );
        }

        const payload = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          model?: string;
        };
        const rawText = payload.choices?.[0]?.message?.content?.trim();
        if (!rawText) {
          throw new AiProviderError('OpenAI returned empty completion');
        }

        const parsed = parseJsonCompletion(rawText, 'OpenAI');

        return {
          rawText,
          parsed,
          model: payload.model || model,
          provider: 'openai',
        };
      } catch (err) {
        lastError = err as Error;
        const retryable =
          err instanceof AiProviderError &&
          (err.statusCode === 429 || (err.statusCode !== undefined && err.statusCode >= 500));
        if (!retryable || attempt >= maxRetries) {
          break;
        }
        this.logger.warn(`OpenAI retry ${attempt + 1}/${maxRetries}: ${(err as Error).message}`);
        await sleep(500 * (attempt + 1));
      }
    }

    throw lastError ?? new AiProviderError('OpenAI request failed');
  }
}

/** Local Ollama — uses POST /api/chat with JSON format (https://github.com/ollama/ollama/blob/main/docs/api.md). */
export class OllamaProvider implements AiProvider {
  private readonly logger = new Logger(OllamaProvider.name);

  async completeStructured(request: StructuredCompletionRequest): Promise<StructuredCompletionResponse> {
    const { ollamaBaseUrl, ollamaModel, ollamaVisionModel, requestTimeoutMs, maxRetries } = getAiConfig();
    const model =
      request.imageDataUrl?.startsWith('data:image/') && ollamaVisionModel
        ? request.model?.trim() || ollamaVisionModel
        : request.model?.trim() || ollamaModel;
    const url = `${ollamaBaseUrl}/api/chat`;
    const userMessage: Record<string, unknown> = request.imageDataUrl?.startsWith('data:image/')
      ? {
          role: 'user',
          content: request.userPrompt,
          images: [request.imageDataUrl.replace(/^data:image\/[^;]+;base64,/, '')],
        }
      : { role: 'user', content: request.userPrompt };
    const body = {
      model,
      stream: false,
      format: 'json',
      messages: [
        {
          role: 'system',
          content: buildStructuredSystemPrompt(request.systemPrompt, request.schemaHint),
        },
        userMessage,
      ],
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(requestTimeoutMs),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new AiProviderError(
            `Ollama HTTP ${res.status}: ${errorText.slice(0, 300)}`,
            res.status,
          );
        }

        const payload = (await res.json()) as {
          model?: string;
          message?: { content?: string };
        };
        const rawText = payload.message?.content?.trim();
        if (!rawText) {
          throw new AiProviderError('Ollama returned empty completion');
        }

        const parsed = parseJsonCompletion(rawText, 'Ollama');

        return {
          rawText,
          parsed,
          model: payload.model || model,
          provider: 'ollama',
        };
      } catch (err) {
        lastError = err as Error;
        const retryable =
          err instanceof AiProviderError &&
          (err.statusCode === undefined ||
            err.statusCode === 429 ||
            err.statusCode >= 500 ||
            err.message.includes('fetch failed') ||
            err.message.includes('ECONNREFUSED'));
        if (!retryable || attempt >= maxRetries) {
          break;
        }
        this.logger.warn(`Ollama retry ${attempt + 1}/${maxRetries}: ${(err as Error).message}`);
        await sleep(500 * (attempt + 1));
      }
    }

    const hint =
      'Ensure Ollama is running (ollama serve), the model is pulled (ollama pull ' +
      `${ollamaModel}), and OLLAMA_BASE_URL reaches the server (WSL: use Windows host IP if Ollama runs on Windows).`;
    const message = lastError?.message ?? 'Ollama request failed';
    throw new AiProviderError(`${message}. ${hint}`);
  }
}

export class MockAiProvider implements AiProvider {
  async completeStructured(request: StructuredCompletionRequest): Promise<StructuredCompletionResponse> {
    if (request.taskKind === 'clean') {
      const originalMatch = request.userPrompt.match(/Original message body:\n([\s\S]*?)(?:\n|$)/);
      const original = (originalMatch?.[1] || '').trim();
      const cleaned = original
        .replace(/^Forwarded from .*$/gim, '')
        .replace(/^Visit @\w+.*$/gim, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      const parsed = {
        cleanedText: cleaned || original,
        changes: cleaned !== original ? ['Removed forwarding/branding lines (mock)'] : [],
        unchanged: cleaned === original,
      };
      return {
        rawText: JSON.stringify(parsed),
        parsed,
        model: 'mock',
        provider: 'mock',
      };
    }

    if (request.taskKind === 'route') {
      const destEntries = [
        ...request.userPrompt.matchAll(
          /chatId:\s*([0-9a-f-]+)\s*\|\s*title:\s*([^|]+)/gi,
        ),
      ];
      const allIds = destEntries.map((entry) => entry[1]);
      const bodyMatch = request.userPrompt.match(
        /Message body:\n([\s\S]*?)(?:\n\nDestination options|$)/,
      );
      const body = (bodyMatch?.[1] || '').toLowerCase();
      const { mockRouteFirstOnly } = getAiConfig();

      let destinationChatIds = allIds;
      let reason = 'Mock route: forward to all configured destinations';

      if (mockRouteFirstOnly && allIds.length > 0) {
        destinationChatIds = [allIds[0]];
        reason = 'Mock route: AI_MOCK_ROUTE_FIRST_ONLY selected first destination';
      } else if (/remote|wfh|work from home/.test(body)) {
        const remote = destEntries.find((entry) => entry[2].toLowerCase().includes('remote'));
        if (remote) {
          destinationChatIds = [remote[1]];
          reason = 'Mock route: remote keyword matched remote destination';
        }
      } else if (/onsite|office|local/.test(body)) {
        const local = destEntries.find((entry) => !entry[2].toLowerCase().includes('remote'));
        if (local) {
          destinationChatIds = [local[1]];
          reason = 'Mock route: onsite/local keyword matched non-remote destination';
        }
      }

      const parsed = {
        destinationChatIds,
        reason,
        confidence: 0.9,
      };
      return {
        rawText: JSON.stringify(parsed),
        parsed,
        model: 'mock',
        provider: 'mock',
      };
    }

    const { mockRelevant, mockNeedsReview } = getAiConfig();
    const parsed = mockRelevant
      ? {
          relevant: true,
          reason: 'Mock provider marked message as relevant',
          confidence: 0.99,
          needsReview: mockNeedsReview,
        }
      : {
          relevant: false,
          reason: 'Mock provider marked message as not relevant',
          confidence: 0.99,
        };

    return {
      rawText: JSON.stringify(parsed),
      parsed,
      model: 'mock',
      provider: 'mock',
    };
  }
}

export function createAiProvider(): AiProvider {
  const { provider } = getAiConfig();
  if (provider === 'mock') {
    return new MockAiProvider();
  }
  if (provider === 'ollama') {
    return new OllamaProvider();
  }
  return new OpenAiProvider();
}
