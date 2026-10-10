import { resolveInboundImageDataUrl } from './waha-message';

describe('resolveInboundImageDataUrl', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.WAHA_API_URL = 'http://127.0.0.1:8081';
    process.env.WAHA_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('downloads a direct WAHA image URL before the pipeline runs', async () => {
    const jpegBytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(jpegBytes, {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      }),
    );

    const result = await resolveInboundImageDataUrl(
      'session-1',
      '123456789@g.us',
      'message-1',
      'http://127.0.0.1:8081/api/files/message-1.jpg',
      'image/jpeg',
    );

    expect(result).toBe(`data:image/jpeg;base64,${jpegBytes.toString('base64')}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8081/api/files/message-1.jpg');
  });

  it('uses the image MIME hint when WAHA responds with application/octet-stream', async () => {
    const jpegBytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(jpegBytes, {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      }),
    );

    const result = await resolveInboundImageDataUrl(
      'session-1',
      '123456789@g.us',
      'message-1',
      'http://127.0.0.1:8081/api/files/message-1.jpg',
      'image/jpeg',
    );

    expect(result).toBe(`data:image/jpeg;base64,${jpegBytes.toString('base64')}`);
  });

  it('uses WAHA message download when the inbound media URL is a WhatsApp CDN URL', async () => {
    const jpegBytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ base64: jpegBytes.toString('base64'), mimetype: 'image/jpeg' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await resolveInboundImageDataUrl(
      'session-1',
      '123456789@g.us',
      'message-1',
      'https://mmg.whatsapp.net/media.enc',
      'image/jpeg',
    );

    expect(result).toBe(`data:image/jpeg;base64,${jpegBytes.toString('base64')}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/api/session-1/chats/123456789%40g.us/messages/message-1?downloadMedia=true',
    );
  });
});