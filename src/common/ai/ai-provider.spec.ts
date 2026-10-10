import { OpenRouterProvider, createAiProvider } from './ai-provider';

describe('OpenRouterProvider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.example/api/v1/';
    process.env.OPENROUTER_MODEL = 'test/text-model';
    process.env.OPENROUTER_VISION_MODEL = 'test/vision-model';
    process.env.AI_MAX_RETRIES = '0';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('selects OpenRouter from AI_PROVIDER', () => {
    expect(createAiProvider()).toBeInstanceOf(OpenRouterProvider);
  });

  it('uses the configured vision model and sends image data as an OpenAI-compatible request', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'test/vision-model',
          choices: [{ message: { content: '{"relevant":true}' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await new OpenRouterProvider().completeStructured({
      systemPrompt: 'Classify the message.',
      userPrompt: 'Inspect this image.',
      schemaHint: '{"relevant": boolean}',
      taskKind: 'relevance',
      imageDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.example/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.model).toBe('test/vision-model');
    expect(requestBody.response_format).toEqual({ type: 'json_object' });
    expect(requestBody.messages[1].content[1].image_url.url).toContain('data:image/jpeg;base64,');
    expect(result).toMatchObject({
      parsed: { relevant: true },
      model: 'test/vision-model',
      provider: 'openrouter',
    });
  });

  it('uses a per-agent model override for text requests', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: '{"cleanedText":"Clean"}' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await new OpenRouterProvider().completeStructured({
      systemPrompt: 'Clean the message.',
      userPrompt: 'Original text.',
      model: 'test/custom-model',
      schemaHint: '{"cleanedText": string}',
      taskKind: 'clean',
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.model).toBe('test/custom-model');
  });
});