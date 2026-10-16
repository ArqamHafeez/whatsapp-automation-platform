import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  generateOpportunityCircleKey,
  hashOpportunityCircleKey,
  keysMatch,
} from './opportunity-circle-key.util';

@Injectable()
export class OpportunityCircleIntegrationService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserOrgId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.organizationId;
  }

  async findByRawKey(rawKey: string) {
    const integrations = await this.prisma.opportunityCircleIntegration.findMany({
      where: { enabled: true, keyHash: { not: null } },
      include: { connection: true },
    });
    return integrations.find((row) => keysMatch(row.keyHash, rawKey)) ?? null;
  }

  async getOrCreateForOrg(orgId: string, defaultConnectionId?: string) {
    const existing = await this.prisma.opportunityCircleIntegration.findUnique({
      where: { orgId },
      include: { connection: { select: { id: true, name: true } } },
    });
    if (existing) {
      return existing;
    }

    let connectionId = defaultConnectionId;
    if (!connectionId) {
      const conn = await this.prisma.whatsAppConnection.findFirst({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
      });
      if (!conn) {
        throw new BadRequestException('Create a WhatsApp connection before enabling Opportunity Circle integration');
      }
      connectionId = conn.id;
    }

    const created = await this.prisma.opportunityCircleIntegration.create({
      data: {
        orgId,
        connectionId,
        enabled: false,
      },
      include: { connection: { select: { id: true, name: true } } },
    });
    return created;
  }

  async getAdminView(orgId: string) {
    const row = await this.getOrCreateForOrg(orgId);
    return {
      id: row.id,
      enabled: row.enabled,
      connectionId: row.connectionId,
      connectionName: row.connection?.name ?? null,
      sinkChatIds: row.sinkChatIds,
      primarySinkChatId: row.primarySinkChatId,
      categoryByRuleId: row.categoryByRuleId,
      defaultCategory: row.defaultCategory,
      hasApiKey: Boolean(row.keyHash),
      updatedAt: row.updatedAt,
    };
  }

  async updateForOrg(
    orgId: string,
    data: {
      enabled?: boolean;
      connectionId?: string;
      sinkChatIds?: string[];
      primarySinkChatId?: string | null;
      categoryByRuleId?: Record<string, string>;
      defaultCategory?: string | null;
    },
  ) {
    const current = await this.getOrCreateForOrg(orgId);
    const connectionId = data.connectionId ?? current.connectionId;

    if (data.connectionId) {
      const conn = await this.prisma.whatsAppConnection.findFirst({
        where: { id: data.connectionId, orgId },
      });
      if (!conn) {
        throw new BadRequestException('Connection not found for this organization');
      }
    }

    if (data.sinkChatIds?.length) {
      const chats = await this.prisma.chat.findMany({
        where: {
          connectionId,
          id: { in: data.sinkChatIds },
          connection: { orgId },
        },
      });
      if (chats.length !== data.sinkChatIds.length) {
        throw new BadRequestException('One or more sink chat IDs are invalid for this connection');
      }
    }

    return this.prisma.opportunityCircleIntegration.update({
      where: { orgId },
      data: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.connectionId !== undefined ? { connectionId: data.connectionId } : {}),
        ...(data.sinkChatIds !== undefined ? { sinkChatIds: data.sinkChatIds } : {}),
        ...(data.primarySinkChatId !== undefined ? { primarySinkChatId: data.primarySinkChatId } : {}),
        ...(data.categoryByRuleId !== undefined ? { categoryByRuleId: data.categoryByRuleId } : {}),
        ...(data.defaultCategory !== undefined ? { defaultCategory: data.defaultCategory } : {}),
      },
    });
  }

  async rotateKey(orgId: string): Promise<{ apiKey: string }> {
    const row = await this.getOrCreateForOrg(orgId);
    const apiKey = generateOpportunityCircleKey();
    await this.prisma.opportunityCircleIntegration.update({
      where: { id: row.id },
      data: { keyHash: hashOpportunityCircleKey(apiKey) },
    });
    return { apiKey };
  }
}
