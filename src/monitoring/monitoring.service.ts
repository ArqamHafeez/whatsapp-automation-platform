<<<<<<< HEAD
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  buildTimeBuckets,
  bucketIndexForTimestamp,
  initForwardBuckets,
  initInboundBuckets,
  initPipelineBuckets,
  initReviewBuckets,
  resolveMetricsWindow,
} from './metrics-window';

export type AnalyticsDashboard = {
  window: string;
  interval: string;
  forwards: Array<{ bucket: string; label: string; sent: number; failed: number; pending: number; capDeferred: number }>;
  reviews: Array<{ bucket: string; label: string; pending: number; approved: number; rejected: number; autoForwarded: number }>;
  pipeline: Array<{ bucket: string; label: string; forward: number; skip: number; review: number }>;
  inbound: Array<{ bucket: string; label: string; count: number }>;
  byRule: Array<{ ruleId: string; ruleName: string; sent: number; failed: number; pending: number; total: number }>;
  byDestination: Array<{ destinationChatId: string; sent: number; failed: number; pending: number; total: number }>;
};

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

  async getAnalytics(userId: string, window = '24h'): Promise<AnalyticsDashboard> {
    const orgId = await this.getUserOrgId(userId);
    const config = resolveMetricsWindow(window);
    const buckets = buildTimeBuckets(config);
    const connectionIds = await this.connectionIdsForOrg(orgId);
    const orgRules = await this.prisma.rule.findMany({
      where: { orgId },
      select: { id: true, name: true },
    });
    const ruleIds = orgRules.map((r) => r.id);
    const ruleNameById = new Map(orgRules.map((r) => [r.id, r.name]));

    const orgScopeFilter =
      ruleIds.length || connectionIds.length
        ? {
            OR: [
              { rule: { orgId } },
              ...(connectionIds.length ? [{ message: { connectionId: { in: connectionIds } } }] : []),
            ],
          }
        : null;

    const [sendLogs, reviewItems, pipelineDecisions, inboundMessages] = await Promise.all([
      orgScopeFilter
        ? this.prisma.sendLog.findMany({
            where: {
              AND: [
                orgScopeFilter,
                {
                  OR: [
                    { sentAt: { gte: config.since } },
                    { createdAt: { gte: config.since } },
                    { lastAttemptAt: { gte: config.since } },
                  ],
                },
              ],
            },
            select: {
              status: true,
              sentAt: true,
              createdAt: true,
              lastAttemptAt: true,
              errorDetails: true,
              ruleId: true,
              destinationChatId: true,
            },
          })
        : Promise.resolve([]),
      ruleIds.length
        ? this.prisma.reviewItem.findMany({
            where: { ruleId: { in: ruleIds }, createdAt: { gte: config.since } },
            select: { status: true, createdAt: true },
          })
        : Promise.resolve([]),
      ruleIds.length
        ? this.prisma.pipelineDecision.findMany({
            where: { ruleId: { in: ruleIds }, createdAt: { gte: config.since } },
            select: { decisionType: true, createdAt: true },
          })
        : Promise.resolve([]),
      connectionIds.length
        ? this.prisma.message.findMany({
            where: { connectionId: { in: connectionIds }, receivedAt: { gte: config.since } },
            select: { receivedAt: true },
          })
        : Promise.resolve([]),
    ]);

    const forwards = initForwardBuckets(buckets);
    const reviews = initReviewBuckets(buckets);
    const pipeline = initPipelineBuckets(buckets);
    const inbound = initInboundBuckets(buckets);

    const isCapDeferred = (errorDetails: string | null | undefined) =>
      Boolean(errorDetails?.toLowerCase().includes('cap'));

    for (const log of sendLogs) {
      if (log.status === 'sent' && log.sentAt) {
        const idx = bucketIndexForTimestamp(buckets, log.sentAt, config.intervalMs);
        if (idx >= 0) forwards[idx].sent += 1;
      }
      if (log.status === 'failed' && log.lastAttemptAt) {
        const idx = bucketIndexForTimestamp(buckets, log.lastAttemptAt, config.intervalMs);
        if (idx >= 0) forwards[idx].failed += 1;
      }
      if (log.status === 'pending') {
        const idx = bucketIndexForTimestamp(buckets, log.createdAt, config.intervalMs);
        if (idx >= 0) {
          forwards[idx].pending += 1;
          if (isCapDeferred(log.errorDetails)) {
            forwards[idx].capDeferred += 1;
          }
        }
      }
    }

    for (const item of reviewItems) {
      const idx = bucketIndexForTimestamp(buckets, item.createdAt, config.intervalMs);
      if (idx < 0) continue;
      if (item.status === 'pending') reviews[idx].pending += 1;
      if (item.status === 'approved') reviews[idx].approved += 1;
      if (item.status === 'rejected') reviews[idx].rejected += 1;
      if (item.status === 'auto_forwarded') reviews[idx].autoForwarded += 1;
    }

    for (const decision of pipelineDecisions) {
      const idx = bucketIndexForTimestamp(buckets, decision.createdAt, config.intervalMs);
      if (idx < 0) continue;
      if (decision.decisionType === 'forward') pipeline[idx].forward += 1;
      if (decision.decisionType === 'skip') pipeline[idx].skip += 1;
      if (decision.decisionType === 'review') pipeline[idx].review += 1;
    }

    for (const message of inboundMessages) {
      const idx = bucketIndexForTimestamp(buckets, message.receivedAt, config.intervalMs);
      if (idx >= 0) inbound[idx].count += 1;
    }

    const ruleStats = new Map<string, { sent: number; failed: number; pending: number; total: number }>();
    const destStats = new Map<string, { sent: number; failed: number; pending: number; total: number }>();

    for (const log of sendLogs) {
      if (log.ruleId) {
        const stats = ruleStats.get(log.ruleId) ?? { sent: 0, failed: 0, pending: 0, total: 0 };
        stats.total += 1;
        if (log.status === 'sent') stats.sent += 1;
        if (log.status === 'failed') stats.failed += 1;
        if (log.status === 'pending') stats.pending += 1;
        ruleStats.set(log.ruleId, stats);
      }

      const destStatsRow = destStats.get(log.destinationChatId) ?? { sent: 0, failed: 0, pending: 0, total: 0 };
      destStatsRow.total += 1;
      if (log.status === 'sent') destStatsRow.sent += 1;
      if (log.status === 'failed') destStatsRow.failed += 1;
      if (log.status === 'pending') destStatsRow.pending += 1;
      destStats.set(log.destinationChatId, destStatsRow);
    }

    const byRule = [...ruleStats.entries()]
      .map(([ruleId, stats]) => ({
        ruleId,
        ruleName: ruleNameById.get(ruleId) ?? 'Unknown rule',
        ...stats,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const byDestination = [...destStats.entries()]
      .map(([destinationChatId, stats]) => ({
        destinationChatId,
        ...stats,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      window: config.window,
      interval: config.intervalLabel,
      forwards,
      reviews,
      pipeline,
      inbound,
      byRule,
      byDestination,
    };
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
=======
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
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
