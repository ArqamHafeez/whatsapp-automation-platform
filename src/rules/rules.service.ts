import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRules() {
    return this.prisma.rule.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRule(data: any) {
    const { orgId, name, description, sourceChatIds, destinationChatIds } = data;
    
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

  async getRule(id: string) {
    return this.prisma.rule.findUnique({
      where: { id },
    });
  }

  async updateRule(id: string, data: any) {
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

  async deleteRule(id: string) {
    await this.prisma.rule.delete({ where: { id } });
    return { deleted: true, id };
  }

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
