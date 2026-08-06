import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { sanitizeStructuredConfig } from '../common/ai/structured-config';
import { CreateAgentDto, UpdateAgentDto } from './agents.dto';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getUserOrgId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.organizationId;
  }

  async listAgents(userId: string) {
    const orgId = await this.getUserOrgId(userId);
    return this.prisma.agent.findMany({
      where: { orgId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async createAgent(userId: string, data: CreateAgentDto) {
    const orgId = await this.getUserOrgId(userId);
    return this.prisma.agent.create({
      data: {
        orgId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        type: data.type,
        systemPrompt: data.systemPrompt?.trim() || null,
        userPromptTemplate: data.userPromptTemplate?.trim() || null,
        model: data.model?.trim() || null,
        structuredConfig: sanitizeStructuredConfig(
          data.type,
          data.structuredConfig as Record<string, unknown> | undefined,
        ) as Prisma.InputJsonValue | undefined,
        advancedPromptOverride: data.advancedPromptOverride?.trim() || null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async getAgent(userId: string, id: string) {
    const orgId = await this.getUserOrgId(userId);
    const agent = await this.prisma.agent.findFirst({ where: { id, orgId } });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    return agent;
  }

  async updateAgent(userId: string, id: string, data: UpdateAgentDto) {
    const orgId = await this.getUserOrgId(userId);
    const existing = await this.prisma.agent.findFirst({ where: { id, orgId } });
    if (!existing) {
      throw new NotFoundException('Agent not found');
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.systemPrompt !== undefined) updateData.systemPrompt = data.systemPrompt?.trim() || null;
    if (data.userPromptTemplate !== undefined) {
      updateData.userPromptTemplate = data.userPromptTemplate?.trim() || null;
    }
    if (data.model !== undefined) updateData.model = data.model?.trim() || null;
    if (data.structuredConfig !== undefined) {
      const agentType = data.type ?? existing.type;
      updateData.structuredConfig = sanitizeStructuredConfig(
        agentType,
        data.structuredConfig as Record<string, unknown>,
      ) as Prisma.InputJsonValue;
    }
    if (data.advancedPromptOverride !== undefined) {
      updateData.advancedPromptOverride = data.advancedPromptOverride?.trim() || null;
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return this.prisma.agent.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteAgent(userId: string, id: string) {
    const orgId = await this.getUserOrgId(userId);
    const existing = await this.prisma.agent.findFirst({ where: { id, orgId } });
    if (!existing) {
      throw new NotFoundException('Agent not found');
    }

    const rulesUsingAgent = await this.prisma.rule.findMany({
      where: { orgId, pipelineAgentIds: { has: id } },
      select: { id: true, name: true },
    });
    if (rulesUsingAgent.length > 0) {
      throw new BadRequestException(
        `Agent is referenced by ${rulesUsingAgent.length} rule(s). Remove it from those pipelines first.`,
      );
    }

    await this.prisma.agent.delete({ where: { id } });
    return { deleted: true, id };
  }

  /** Validates agent IDs belong to org; used when saving rules. */
  async assertAgentsInOrg(orgId: string, agentIds: string[]): Promise<void> {
    const unique = [...new Set(agentIds)];
    if (unique.length !== agentIds.length) {
      throw new BadRequestException('Duplicate agent IDs are not allowed in a pipeline');
    }
    if (!unique.length) {
      return;
    }

    const rows = await this.prisma.agent.findMany({
      where: { orgId, id: { in: unique }, isActive: true },
      select: { id: true },
    });
    if (rows.length !== unique.length) {
      throw new BadRequestException(
        'Every pipeline agent must be an active agent in your organization',
      );
    }
  }
}
