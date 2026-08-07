import { Injectable, Logger } from '@nestjs/common';
import { Agent } from '@prisma/client';
import sharp from 'sharp';
import { createAiProvider } from '../ai/ai-provider';
import { getAiConfig } from '../ai/ai.config';
import { buildAgentPrompts, buildDefaultImageEditUserPrompt, DEFAULT_IMAGE_EDIT_SYSTEM_PROMPT } from '../ai/prompt-builder';
import { AgentRunContext } from '../ai/ai.types';
import { getImageEditConfig } from './image-edit.config';
import {
  defaultCornerRegions,
  parseWatermarkLocateResult,
  WATERMARK_LOCATE_SCHEMA_HINT,
  WatermarkLocateResult,
} from './watermark-region.schema';
import { removeWatermarkRegionsCloud } from './watermark-remove.cloud';
import { removeWatermarkRegionsLocal } from './watermark-remove.local';
import { parseDataUrl, toDataUrl } from './watermark-remove.shared';
import { readImageEditStructuredConfig } from '../ai/structured-config';

export type ImageEditAgentResult = {
  edited: boolean;
  mediaUrl: string | null;
  originalMediaUrl: string | null;
  method: 'local' | 'cloud' | 'skipped';
  regionsRemoved: string[];
  confidence: number;
  needsReview: boolean;
  reason: string;
  locate?: WatermarkLocateResult;
};

@Injectable()
export class ImageEditService {
  private readonly logger = new Logger(ImageEditService.name);
  private readonly provider = createAiProvider();

  async runImageEditAgent(
    agent: Agent,
    context: AgentRunContext,
    opts?: { watermarkHint?: boolean },
  ): Promise<ImageEditAgentResult> {
    const mediaUrl = context.message.mediaUrl;
    if (context.message.type !== 'image' || !mediaUrl?.startsWith('data:image/')) {
      return {
        edited: false,
        mediaUrl,
        originalMediaUrl: mediaUrl,
        method: 'skipped',
        regionsRemoved: [],
        confidence: 1,
        needsReview: false,
        reason: 'Not an image message — image edit skipped',
      };
    }

    const config = readImageEditStructuredConfig(agent);
    if (config.onlyWhenWatermarkDetected && !opts?.watermarkHint) {
      return {
        edited: false,
        mediaUrl,
        originalMediaUrl: mediaUrl,
        method: 'skipped',
        regionsRemoved: [],
        confidence: 1,
        needsReview: false,
        reason: 'Skipped — no watermark hint from relevance agent',
      };
    }

    const { maxBytes, cornerFallback, provider: editProvider } = getImageEditConfig();
    const { mimeType, buffer } = parseDataUrl(mediaUrl);
    if (buffer.length > maxBytes) {
      return {
        edited: false,
        mediaUrl,
        originalMediaUrl: mediaUrl,
        method: 'skipped',
        regionsRemoved: [],
        confidence: 0,
        needsReview: config.reviewOnFailure !== 'false',
        reason: `Image exceeds max size (${buffer.length} bytes)`,
      };
    }

    const locate = await this.locateWatermarkRegions(agent, context, mediaUrl);
    let regions = locate.regions;
    if (!regions.length && (locate.hasWatermark || opts?.watermarkHint) && cornerFallback) {
      regions = defaultCornerRegions();
    }
    if (!regions.length && !locate.hasWatermark && !opts?.watermarkHint) {
      return {
        edited: false,
        mediaUrl,
        originalMediaUrl: mediaUrl,
        method: 'skipped',
        regionsRemoved: [],
        confidence: locate.confidence,
        needsReview: false,
        reason: locate.reason || 'No watermark regions to remove',
        locate,
      };
    }

    const minConfidence = Number(config.minConfidence || '0.6');
    if (locate.confidence < minConfidence && !opts?.watermarkHint) {
      return {
        edited: false,
        mediaUrl,
        originalMediaUrl: mediaUrl,
        method: 'skipped',
        regionsRemoved: [],
        confidence: locate.confidence,
        needsReview: config.reviewOnFailure !== 'false',
        reason: `Watermark locate confidence ${locate.confidence.toFixed(2)} below threshold ${minConfidence}`,
        locate,
      };
    }

    try {
      const prompt =
        config.removePrompt?.trim() ||
        'Remove channel watermark, logo overlay, and forwarded branding. Fill naturally with background.';

      let outputBuffer: Buffer;
      let outputMime = mimeType;
      let method: 'local' | 'cloud' = 'local';
      let regionsRemoved: string[] = [];

      if (editProvider === 'cloud') {
        const cloud = await removeWatermarkRegionsCloud(buffer, regions, prompt);
        outputBuffer = cloud.buffer;
        outputMime = cloud.mimeType;
        method = 'cloud';
        regionsRemoved = regions.map((r) => r.label || 'region');
      } else {
        const local = await removeWatermarkRegionsLocal(buffer, regions);
        outputBuffer = local.buffer;
        outputMime = local.mimeType;
        regionsRemoved = local.regionsTouched;
      }

      await sharpValidate(outputBuffer);

      const editedUrl = toDataUrl(outputBuffer, outputMime);
      return {
        edited: true,
        mediaUrl: editedUrl,
        originalMediaUrl: mediaUrl,
        method,
        regionsRemoved,
        confidence: locate.confidence,
        needsReview: config.reviewAfterEdit === 'true',
        reason: `Removed watermark from ${regionsRemoved.length} region(s) via ${method}`,
        locate,
      };
    } catch (err) {
      this.logger.warn(`Image edit failed: ${(err as Error).message}`);
      return {
        edited: false,
        mediaUrl,
        originalMediaUrl: mediaUrl,
        method: editProvider === 'cloud' ? 'cloud' : 'local',
        regionsRemoved: [],
        confidence: locate.confidence,
        needsReview: config.reviewOnFailure !== 'false',
        reason: `Image edit failed: ${(err as Error).message}`,
        locate,
      };
    }
  }

  private async locateWatermarkRegions(
    agent: Agent,
    context: AgentRunContext,
    imageDataUrl: string,
  ): Promise<WatermarkLocateResult> {
    const defaultUserPrompt = buildDefaultImageEditUserPrompt(context);
    const { systemPrompt, userPrompt } = buildAgentPrompts(agent, context, defaultUserPrompt);
    const { openaiVisionModel } = getAiConfig();

    const completion = await this.provider.completeStructured({
      systemPrompt: systemPrompt || DEFAULT_IMAGE_EDIT_SYSTEM_PROMPT,
      userPrompt,
      model: agent.model?.trim() || openaiVisionModel,
      schemaHint: WATERMARK_LOCATE_SCHEMA_HINT,
      taskKind: 'relevance',
      imageDataUrl,
    });

    return parseWatermarkLocateResult(completion.parsed);
  }
}

async function sharpValidate(buffer: Buffer): Promise<void> {
  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) {
    throw new Error('Edited output is not a valid image');
  }
}
