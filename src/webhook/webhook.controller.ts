import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RulesService } from '../rules/rules.service';
import { DeliveryService } from '../delivery/delivery.service';

@Controller('webhook')
export class WebhookController {
  constructor(
    private prisma: PrismaService,
    private rules: RulesService,
    private delivery: DeliveryService,
  ) {}

  @Post('evolution')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any) {
    if (payload.data?.key?.fromMe) {
      return { received: true, action: 'ignored_from_me' };
    }

    const instanceName = payload.instance;
    const instance = await this.prisma.whatsAppConnection.findFirst({
      where: { name: instanceName },
    });

    if (!instance) {
      return { received: false, reason: 'instance_not_found' };
    }

    const msgData = payload.data;
    const waMessageId = msgData.key.id;
    const chatId = msgData.key.remoteJid;
    const sender = msgData.pushName || msgData.key.remoteJid;

    let body = '';
    let type: any = 'text';
    let mediaUrl: string | null = null;

    if (msgData.message?.conversation) {
      body = msgData.message.conversation;
    } else if (msgData.message?.imageMessage) {
      body = msgData.message.imageMessage.caption || '';
      type = 'image';
      mediaUrl = msgData.message.imageMessage.url || null;
    } else if (msgData.message?.documentMessage) {
      body = msgData.message.documentMessage.caption || '';
      type = 'document';
      mediaUrl = msgData.message.documentMessage.url || null;
    } else if (msgData.message?.videoMessage) {
      body = msgData.message.videoMessage.caption || '';
      type = 'video';
      mediaUrl = msgData.message.videoMessage.url || null;
    }

    const existing = await this.prisma.message.findUnique({
      where: { waMessageId_connectionId: { waMessageId, connectionId: instance.id } },
    });

    if (existing) {
      return { received: true, action: 'duplicate_ignored', messageId: existing.id };
    }

    const message = await this.prisma.message.create({
      data: {
        waMessageId,
        connectionId: instance.id,
        chatId,
        sender,
        body,
        type,
        mediaUrl,
        metadata: payload,
      },
    });

    const rules = await this.rules.findMatchingRules(chatId, instance.orgId);
    
    for (const rule of rules) {
      for (const destChatId of rule.destinationChatIds) {
        await this.delivery.enqueueDelivery({
          messageId: message.id,
          destinationChatId: destChatId,
          ruleId: rule.id,
          connectionId: instance.id,
          body: message.body,
          type: message.type,
          mediaUrl: message.mediaUrl,
        });
      }
    }

    return { 
      received: true, 
      messageId: message.id,
      rulesMatched: rules.length,
      destinations: rules.reduce((sum, r) => sum + r.destinationChatIds.length, 0),
    };
  }
}
