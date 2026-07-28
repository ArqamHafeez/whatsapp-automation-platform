import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getUserOrgId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.organizationId;
  }

  async listRules(userId: string) {
    const orgId = await this.getUserOrgId(userId);
    return this.prisma.rule.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRule(userId: string, data: any) {
    const orgId = await this.getUserOrgId(userId);
    // orgId is resolved server-side from the authenticated user, never taken from
    // the request body — a client-supplied orgId here would let any authenticated
    // user create rules in another org.
    const { name, description, sourceChatIds, destinationChatIds } = data;

    return this.prisma.rule.create({
      data: {
        orgId,
        name,
        description: description || null,
        isActive: true,
        sourceChatIds: sourceChatIds || [],
        destinationChatIds: destinationChatIds || [],
      },
    });
  }

  async getRule(userId: string, id: string) {
    const orgId = await this.getUserOrgId(userId);
    const rule = await this.prisma.rule.findFirst({ where: { id, orgId } });
    if (!rule) {
      throw new NotFoundException('Rule not found');
    }
    return rule;
  }

  async updateRule(userId: string, id: string, data: any) {
    const orgId = await this.getUserOrgId(userId);
    const existing = await this.prisma.rule.findFirst({ where: { id, orgId } });
    if (!existing) {
      throw new NotFoundException('Rule not found');
    }

    const { name, description, isActive, sourceChatIds, destinationChatIds } = data;
    return this.prisma.rule.update({
      where: { id },
      data: {
        name,
        description,
        isActive,
        sourceChatIds,
        destinationChatIds,
      },
    });
  }

  async deleteRule(userId: string, id: string) {
    const orgId = await this.getUserOrgId(userId);
    const existing = await this.prisma.rule.findFirst({ where: { id, orgId } });
    if (!existing) {
      throw new NotFoundException('Rule not found');
    }
    await this.prisma.rule.delete({ where: { id } });
    return { deleted: true, id };
  }

  /**
   * Internal use only — called from WebhookController's incoming-message handling,
   * not exposed as a RulesController route. orgId here comes from the resolved
   * WhatsAppConnection record (webhook calls are Evolution API's own requests, not
   * an authenticated user session, so there's no userId to resolve org from).
   */
  async findMatchingRules(chatId: string, orgId: string) {
    return this.prisma.rule.findMany({
      where: {
        orgId,
        isActive: true,
        sourceChatIds: {
          has: chatId,
        },
      },
    });
  }
}
