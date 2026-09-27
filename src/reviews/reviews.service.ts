<<<<<<< HEAD
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DeliveryService } from '../delivery/delivery.service';
import { RulesService } from '../rules/rules.service';
import { parseReviewForwardPayload } from './review.types';

const REVIEW_POLL_INTERVAL_MS = 60_000;

@Injectable()
export class ReviewsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReviewsService.name);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: DeliveryService,
    private readonly rules: RulesService,
  ) {}

  onModuleInit() {
    this.pollTimer = setInterval(() => {
      this.processExpiredReviews().catch((err) => {
        this.logger.error(`Review timeout poll failed: ${(err as Error).message}`);
      });
    }, REVIEW_POLL_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async listReviews(userId: string, status?: string) {
    const orgId = await this.getUserOrgId(userId);
    const ruleIds = await this.getOrgRuleIds(orgId);
    if (!ruleIds.length) {
      return [];
    }

    const items = await this.prisma.reviewItem.findMany({
      where: {
        ruleId: { in: ruleIds },
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(items.map((item) => this.enrichReviewItem(item)));
  }

  async getReview(userId: string, id: string) {
    const item = await this.findReviewForUser(userId, id);
    return this.enrichReviewItem(item);
  }

  async approve(userId: string, id: string, data: { reviewNotes?: string }) {
    const item = await this.findReviewForUser(userId, id);
    if (item.status !== 'pending') {
      throw new BadRequestException(`Review item is already ${item.status}`);
    }

    await this.forwardReviewItem(item, userId, 'approved', data.reviewNotes);
    return this.getReview(userId, id);
  }

  async reject(userId: string, id: string, data: { reviewNotes?: string }) {
    const item = await this.findReviewForUser(userId, id);
    if (item.status !== 'pending') {
      throw new BadRequestException(`Review item is already ${item.status}`);
    }

    await this.prisma.reviewItem.update({
      where: { id: item.id },
      data: {
        status: 'rejected',
        reviewerId: userId,
        reviewNotes: data.reviewNotes?.trim() || null,
      },
    });

    return this.getReview(userId, id);
  }

  async updateReview(userId: string, id: string, data: { reviewNotes?: string }) {
    await this.findReviewForUser(userId, id);
    await this.prisma.reviewItem.update({
      where: { id },
      data: {
        reviewNotes: data.reviewNotes?.trim() || null,
      },
    });
    return this.getReview(userId, id);
  }

  async processExpiredReviews() {
    if (this.isPolling) {
      return;
    }
    this.isPolling = true;
    try {
      const expired = await this.prisma.reviewItem.findMany({
        where: {
          status: 'pending',
          expiresAt: { lte: new Date() },
        },
        take: 25,
        orderBy: { expiresAt: 'asc' },
      });

      for (const item of expired) {
        try {
          await this.forwardReviewItem(item, null, 'auto_forwarded');
          this.logger.log(`Auto-forwarded expired review ${item.id}`);
        } catch (err) {
          this.logger.error(`Failed auto-forward review ${item.id}: ${(err as Error).message}`);
        }
      }
    } finally {
      this.isPolling = false;
    }
  }

  private async forwardReviewItem(
    item: { id: string; ruleId: string; originalPayload: string; messageId: string },
    reviewerId: string | null,
    status: 'approved' | 'auto_forwarded',
    reviewNotes?: string,
  ) {
    const payload = parseReviewForwardPayload(item.originalPayload);
    const rule = await this.prisma.rule.findUnique({
      where: { id: item.ruleId },
      select: { orgId: true },
    });
    if (!rule) {
      throw new NotFoundException('Rule not found for review item');
    }

    const destinationJids = await this.rules.resolveDestinationJids(
      payload.destinationChatIds,
      rule.orgId,
      payload.connectionId,
    );

    for (const destChatJid of destinationJids) {
      await this.delivery.enqueueDelivery({
        messageId: item.messageId,
        destinationChatId: destChatJid,
        ruleId: item.ruleId,
        connectionId: payload.connectionId,
        body: payload.body,
        type: payload.type,
        mediaUrl: payload.mediaUrl,
        pipelineMode: payload.pipelineMode,
      });
    }

    await this.prisma.reviewItem.update({
      where: { id: item.id },
      data: {
        status,
        reviewerId,
        reviewNotes: reviewNotes?.trim() || null,
      },
    });
  }

  private async findReviewForUser(userId: string, id: string) {
    const orgId = await this.getUserOrgId(userId);
    const ruleIds = await this.getOrgRuleIds(orgId);
    const item = await this.prisma.reviewItem.findFirst({
      where: { id, ruleId: { in: ruleIds } },
    });
    if (!item) {
      throw new NotFoundException('Review item not found');
    }
    return item;
  }

  private async enrichReviewItem(item: any) {
    const payload = parseReviewForwardPayload(item.originalPayload);
    const message = item.messageId
      ? await this.prisma.message.findUnique({
          where: { id: item.messageId },
          select: { id: true, body: true, type: true, sender: true, chatId: true, receivedAt: true },
        })
      : null;
    const rule = await this.prisma.rule.findUnique({
      where: { id: item.ruleId },
      select: { id: true, name: true, reviewMode: true },
    });

    return {
      ...item,
      payload,
      message,
      rule,
    };
  }

  private async getOrgRuleIds(orgId: string): Promise<string[]> {
    const rules = await this.prisma.rule.findMany({
      where: { orgId },
      select: { id: true },
    });
    return rules.map((rule) => rule.id);
  }

  private async getUserOrgId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.organizationId;
  }
}
=======
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DeliveryService } from '../delivery/delivery.service';
import { RulesService } from '../rules/rules.service';
import { parseReviewForwardPayload } from './review.types';

const REVIEW_POLL_INTERVAL_MS = 60_000;

@Injectable()
export class ReviewsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReviewsService.name);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: DeliveryService,
    private readonly rules: RulesService,
  ) {}

  onModuleInit() {
    this.pollTimer = setInterval(() => {
      this.processExpiredReviews().catch((err) => {
        this.logger.error(`Review timeout poll failed: ${(err as Error).message}`);
      });
    }, REVIEW_POLL_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async listReviews(userId: string, status?: string) {
    const orgId = await this.getUserOrgId(userId);
    const ruleIds = await this.getOrgRuleIds(orgId);
    if (!ruleIds.length) {
      return [];
    }

    const items = await this.prisma.reviewItem.findMany({
      where: {
        ruleId: { in: ruleIds },
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(items.map((item) => this.enrichReviewItem(item)));
  }

  async getReview(userId: string, id: string) {
    const item = await this.findReviewForUser(userId, id);
    return this.enrichReviewItem(item);
  }

  async approve(userId: string, id: string, data: { reviewNotes?: string }) {
    const item = await this.findReviewForUser(userId, id);
    if (item.status !== 'pending') {
      throw new BadRequestException(`Review item is already ${item.status}`);
    }

    await this.forwardReviewItem(item, userId, 'approved', data.reviewNotes);
    return this.getReview(userId, id);
  }

  async reject(userId: string, id: string, data: { reviewNotes?: string }) {
    const item = await this.findReviewForUser(userId, id);
    if (item.status !== 'pending') {
      throw new BadRequestException(`Review item is already ${item.status}`);
    }

    await this.prisma.reviewItem.update({
      where: { id: item.id },
      data: {
        status: 'rejected',
        reviewerId: userId,
        reviewNotes: data.reviewNotes?.trim() || null,
      },
    });

    return this.getReview(userId, id);
  }

  async updateReview(userId: string, id: string, data: { reviewNotes?: string }) {
    await this.findReviewForUser(userId, id);
    await this.prisma.reviewItem.update({
      where: { id },
      data: {
        reviewNotes: data.reviewNotes?.trim() || null,
      },
    });
    return this.getReview(userId, id);
  }

  async processExpiredReviews() {
    if (this.isPolling) {
      return;
    }
    this.isPolling = true;
    try {
      const expired = await this.prisma.reviewItem.findMany({
        where: {
          status: 'pending',
          expiresAt: { lte: new Date() },
        },
        take: 25,
        orderBy: { expiresAt: 'asc' },
      });

      for (const item of expired) {
        try {
          await this.forwardReviewItem(item, null, 'auto_forwarded');
          this.logger.log(`Auto-forwarded expired review ${item.id}`);
        } catch (err) {
          this.logger.error(`Failed auto-forward review ${item.id}: ${(err as Error).message}`);
        }
      }
    } finally {
      this.isPolling = false;
    }
  }

  private async forwardReviewItem(
    item: { id: string; ruleId: string; originalPayload: string; messageId: string },
    reviewerId: string | null,
    status: 'approved' | 'auto_forwarded',
    reviewNotes?: string,
  ) {
    const payload = parseReviewForwardPayload(item.originalPayload);
    const rule = await this.prisma.rule.findUnique({
      where: { id: item.ruleId },
      select: { orgId: true },
    });
    if (!rule) {
      throw new NotFoundException('Rule not found for review item');
    }

    const destinationJids = await this.rules.resolveDestinationJids(
      payload.destinationChatIds,
      rule.orgId,
      payload.connectionId,
    );

    for (const destChatJid of destinationJids) {
      await this.delivery.enqueueDelivery({
        messageId: item.messageId,
        destinationChatId: destChatJid,
        ruleId: item.ruleId,
        connectionId: payload.connectionId,
        body: payload.body,
        type: payload.type,
        mediaUrl: payload.mediaUrl,
        pipelineMode: payload.pipelineMode,
      });
    }

    await this.prisma.reviewItem.update({
      where: { id: item.id },
      data: {
        status,
        reviewerId,
        reviewNotes: reviewNotes?.trim() || null,
      },
    });
  }

  private async findReviewForUser(userId: string, id: string) {
    const orgId = await this.getUserOrgId(userId);
    const ruleIds = await this.getOrgRuleIds(orgId);
    const item = await this.prisma.reviewItem.findFirst({
      where: { id, ruleId: { in: ruleIds } },
    });
    if (!item) {
      throw new NotFoundException('Review item not found');
    }
    return item;
  }

  private async enrichReviewItem(item: any) {
    const payload = parseReviewForwardPayload(item.originalPayload);
    const message = item.messageId
      ? await this.prisma.message.findUnique({
          where: { id: item.messageId },
          select: { id: true, body: true, type: true, sender: true, chatId: true, receivedAt: true },
        })
      : null;
    const rule = await this.prisma.rule.findUnique({
      where: { id: item.ruleId },
      select: { id: true, name: true, reviewMode: true },
    });

    return {
      ...item,
      payload,
      message,
      rule,
    };
  }

  private async getOrgRuleIds(orgId: string): Promise<string[]> {
    const rules = await this.prisma.rule.findMany({
      where: { orgId },
      select: { id: true },
    });
    return rules.map((rule) => rule.id);
  }

  private async getUserOrgId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.organizationId;
  }
}
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
