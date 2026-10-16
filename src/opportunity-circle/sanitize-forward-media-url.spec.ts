import { sanitizeForwardMediaUrl } from './sanitize-forward-media-url';

describe('sanitizeForwardMediaUrl', () => {
  it('returns null for data URLs', () => {
    expect(sanitizeForwardMediaUrl('data:image/jpeg;base64,abc')).toBeNull();
  });

  it('keeps https URLs', () => {
    expect(sanitizeForwardMediaUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
  });

  it('returns null for empty', () => {
    expect(sanitizeForwardMediaUrl(null)).toBeNull();
    expect(sanitizeForwardMediaUrl('')).toBeNull();
  });
});
