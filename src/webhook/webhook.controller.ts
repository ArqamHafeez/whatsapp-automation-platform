import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { InboundMessageService } from '../ingestion/inbound-message.service';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly inbound: InboundMessageService) {}

  @Post('waha')
  @HttpCode(HttpStatus.OK)
  async handleWahaWebhook(@Body() payload: any) {
    const sessionName = payload?.session ?? 'unknown';
    const eventName = String(payload?.event ?? '').toLowerCase();
    this.logger.log(`WAHA webhook received session=${sessionName} event=${payload?.event ?? 'n/a'}`);

    const isInboundMessageEvent =
      !eventName || eventName === 'message' || eventName === 'message.any';
    if (!isInboundMessageEvent) {
      return { received: true, action: 'ignored_event', event: payload?.event };
    }

    const result = await this.inbound.processWahaPayload(payload as Record<string, unknown>);

    if (result.action === 'ignored') {
      if (result.reason === 'from_me') {
        this.logger.log(`Ignored fromMe message session=${sessionName}`);
      }
      return { received: true, action: result.reason === 'from_me' ? 'ignored_from_me' : result.reason };
    }

    if (result.action === 'duplicate_ignored') {
      return { received: true, action: 'duplicate_ignored', messageId: result.messageId };
    }

    this.logger.log(
      `Message stored id=${result.messageId} type=${result.messageType} rulesMatched=${result.rulesMatched}`,
    );

    return {
      received: true,
      messageId: result.messageId,
      messageType: result.messageType,
      hasMedia: result.hasMedia,
      rulesMatched: result.rulesMatched,
      pipelineRuns: result.pipelineRuns,
      reviewsQueued: result.reviewsQueued,
      destinations: result.destinations,
    };
  }
}
