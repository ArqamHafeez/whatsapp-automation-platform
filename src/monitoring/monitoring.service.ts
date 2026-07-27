import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

type SendLogRecord = {
  status: string;
  createdAt?: Date | null;
  errorDetails?: string | null;
};

type ReviewItemRecord = {
  status: string;
};

@Injectable()
export class MonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async getThroughput(window = '1h') {
    const since = this.getWindowStart(window);
    const prismaAny = this.prisma as unknown as {
      sendLog?: { findMany: (args?: unknown) => Promise<SendLogRecord[]> };
    };

    const logs = await prismaAny.sendLog?.findMany({
      where: since ? { createdAt: { gte: since } } : undefined,
      select: { status: true, createdAt: true, errorDetails: true },
    });

    const records = logs ?? [];
    const total = records.length;
    const sent = records.filter((log: SendLogRecord) => log.status === 'sent').length;
    const failed = records.filter((log: SendLogRecord) => log.status === 'failed').length;
    const successRate = total > 0 ? Number(((sent / total) * 100).toFixed(2)) : 0;

    return {
      window,
      total,
      sent,
      failed,
      successRate,
    };
  }

  async getFailureSummary() {
    const prismaAny = this.prisma as unknown as {
      sendLog?: { findMany: (args?: unknown) => Promise<SendLogRecord[]> };
    };

    const logs = (await prismaAny.sendLog?.findMany({
      where: { status: 'failed' },
      select: { errorDetails: true },
    })) ?? [];

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

  async getReviewSummary() {
    const prismaAny = this.prisma as unknown as {
      reviewItem?: { findMany: (args?: unknown) => Promise<ReviewItemRecord[]> };
    };

    const reviewItems = (await prismaAny.reviewItem?.findMany({
      select: { status: true },
    })) ?? [];

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

    return summary;
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
