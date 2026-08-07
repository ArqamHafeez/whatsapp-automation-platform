import { defaultCornerRegions, parseWatermarkLocateResult } from './watermark-region.schema';

describe('parseWatermarkLocateResult', () => {
  it('parses watermark regions from vision JSON', () => {
    const result = parseWatermarkLocateResult({
      hasWatermark: true,
      confidence: 0.9,
      reason: 'Corner logo detected',
      regions: [{ x: 0.7, y: 0.8, width: 0.25, height: 0.15, label: 'logo' }],
    });

    expect(result.hasWatermark).toBe(true);
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].label).toBe('logo');
  });

  it('returns default corner presets', () => {
    expect(defaultCornerRegions()).toHaveLength(2);
  });
});
