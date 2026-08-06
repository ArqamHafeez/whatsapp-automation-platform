import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  private async getUserOrgId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.organizationId;
  }

  private async connectionIdsForOrg(orgId: string): Promise<string[]> {
    const connections = await this.prisma.whatsAppConnection.findMany({
      where: { orgId },
      select: { id: true },
    });
    return connections.map((c) => c.id);
  }

  async getThroughput(userId: string, window = '1h') {
    const orgId = await this.getUserOrgId(userId);
    const since = this.getWindowStart(window);
    const connectionIds = await this.connectionIdsForOrg(orgId);

    const logs = await this.prisma.sendLog.findMany({
      where: {
        OR: [
          { rule: { orgId } },
          ...(connectionIds.length ? [{ message: { connectionId: { in: connectionIds } } }] : []),
        ],
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      select: { status: true },
    });

    const total = logs.length;
    const sent = logs.filter((log) => log.status === 'sent').length;
    const failed = logs.filter((log) => log.status === 'failed').length;
    const pending = logs.filter((log) => log.status === 'pending').length;
    const forwardedOnPipelineError = logs.filter(
      (log) => log.status === 'forwarded_on_pipeline_error',
    ).length;
    const successRate = total > 0 ? Number(((sent / total) * 100).toFixed(2)) : 0;

    const orgRules = await this.prisma.rule.findMany({
      where: { orgId },
      select: { id: true },
    });
    const ruleIds = orgRules.map((rule) => rule.id);
    const dropped =
      ruleIds.length > 0
        ? await this.prisma.pipelineDecision.count({
            where: {
              ruleId: { in: ruleIds },
              decisionType: 'skip',
              ...(since ? { createdAt: { gte: since } } : {}),
            },
          })
        : 0;

    return {
      window,
      total,
      sent,
      failed,
      pending,
      dropped,
      forwardedOnPipelineError,
      successRate,
    };
  }

  async getFailureSummary(userId: string) {
    const orgId = await this.getUserOrgId(userId);
    const connectionIds = await this.connectionIdsForOrg(orgId);

    const logs = await this.prisma.sendLog.findMany({
      where: {
        status: 'failed',
        OR: [
          { rule: { orgId } },
          ...(connectionIds.length ? [{ message: { connectionId: { in: connectionIds } } }] : []),
        ],
      },
      select: { errorDetails: true },
    });

    const byReason = logs.reduce<Record<string, number>>((acc, log) => {
      const reason = log.errorDetails?.trim() || 'Unknown error';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

    return {
      total: logs.length,
      byReason,
    };
  }

  async getReviewSummary(userId: string) {
    const orgId = await this.getUserOrgId(userId);
    const ruleIds = (
      await this.prisma.rule.findMany({
        where: { orgId },
        select: { id: true },
      })
    ).map((rule) => rule.id);

    if (!ruleIds.length) {
      return { total: 0, pending: 0, approved: 0, rejected: 0, oldestPendingAgeMinutes: null };
    }

    const reviewItems = await this.prisma.reviewItem.findMany({
      where: { ruleId: { in: ruleIds } },
      select: { status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const summary = reviewItems.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.status === 'pending') acc.pending += 1;
        if (item.status === 'approved') acc.approved += 1;
        if (item.status === 'rejected') acc.rejected += 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, rejected: 0 },
    );

    const oldestPending = reviewItems.find((item) => item.status === 'pending');
    const oldestPendingAgeMinutes = oldestPending
      ? Math.floor((Date.now() - oldestPending.createdAt.getTime()) / 60_000)
      : null;

    return { ...summary, oldestPendingAgeMinutes };
  }

  async getConnectionHealth(userId: string) {
    const orgId = await this.getUserOrgId(userId);

    const connections = await this.prisma.whatsAppConnection.findMany({
      where: { orgId },
      select: { id: true, name: true, status: true, lastSeenAt: true },
    });

    const connectionIds = await this.connectionIdsForOrg(orgId);

    const failedSendCount = await this.prisma.sendLog.count({
      where: {
        status: 'failed',
        nextAttemptAt: null,
        OR: [
          { rule: { orgId } },
          ...(connectionIds.length ? [{ message: { connectionId: { in: connectionIds } } }] : []),
        ],
      },
    });

    return { connections, failedSendCount };
  }

  private getWindowStart(window: string): Date | null {
    const now = new Date();
    const normalized = window?.toLowerCase() || '1h';

    if (normalized.endsWith('h')) {
      const hours = Number(normalized.replace('h', '')) || 1;
      return new Date(now.getTime() - hours * 60 * 60 * 1000);
    }

    if (normalized.endsWith('d')) {
      const days = Number(normalized.replace('d', '')) || 1;
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    return null;
  }
}
