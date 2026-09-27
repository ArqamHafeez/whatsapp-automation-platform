import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringService } from './monitoring.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let prisma: {
    user: { findUnique: jest.Mock };
    sendLog: { findMany: jest.Mock; count: jest.Mock };
    reviewItem: { findMany: jest.Mock };
    whatsAppConnection: { findMany: jest.Mock };
    rule: { findMany: jest.Mock };
    pipelineDecision: { count: jest.Mock; findMany: jest.Mock };
    message: { findMany: jest.Mock };
  };

  const userId = 'user-1';
  const orgId = 'org-1';

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: userId, organizationId: orgId }),
      },
      sendLog: { findMany: jest.fn(), count: jest.fn() },
      reviewItem: { findMany: jest.fn() },
      whatsAppConnection: { findMany: jest.fn().mockResolvedValue([]) },
      rule: { findMany: jest.fn().mockResolvedValue([{ id: 'rule-1' }]) },
      pipelineDecision: { count: jest.fn().mockResolvedValue(2), findMany: jest.fn().mockResolvedValue([]) },
      message: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
  });

  it('returns throughput metrics for the requested window', async () => {
    prisma.sendLog.findMany.mockResolvedValue([
      { status: 'sent' },
      { status: 'failed' },
      { status: 'sent' },
    ]);

    const result = await service.getThroughput(userId, '1h');

    expect(result.window).toBe('1h');
    expect(result.total).toBe(3);
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.dropped).toBe(2);
    expect(result.successRate).toBe(66.67);
  });

  it('returns a failure summary with counts by reason', async () => {
    prisma.sendLog.findMany.mockResolvedValue([
      { errorDetails: 'Rate limit exceeded' },
      { errorDetails: 'Rate limit exceeded' },
      { errorDetails: 'Timeout' },
    ]);

    const result = await service.getFailureSummary(userId);

    expect(result.total).toBe(3);
    expect(result.byReason).toEqual({
      'Rate limit exceeded': 2,
      Timeout: 1,
    });
  });

  it('returns review summary metrics', async () => {
    prisma.reviewItem.findMany.mockResolvedValue([
      { status: 'pending', createdAt: new Date('2026-07-24T10:00:00.000Z') },
      { status: 'approved', createdAt: new Date('2026-07-24T11:00:00.000Z') },
      { status: 'rejected', createdAt: new Date('2026-07-24T12:00:00.000Z') },
    ]);

    const result = await service.getReviewSummary(userId);

    expect(result.total).toBe(3);
    expect(result.pending).toBe(1);
    expect(result.approved).toBe(1);
    expect(result.rejected).toBe(1);
  });

  it('returns analytics timeseries for forwards and pipeline', async () => {
    const now = new Date('2026-08-06T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    prisma.rule.findMany.mockResolvedValue([{ id: 'rule-1', name: 'Main rule' }]);
    prisma.sendLog.findMany.mockResolvedValue([
      {
        status: 'sent',
        sentAt: new Date('2026-08-06T11:30:00.000Z'),
        createdAt: new Date('2026-08-06T11:29:00.000Z'),
        lastAttemptAt: new Date('2026-08-06T11:30:00.000Z'),
        errorDetails: null,
        ruleId: 'rule-1',
        destinationChatId: '111@g.us',
      },
      {
        status: 'pending',
        sentAt: null,
        createdAt: new Date('2026-08-06T11:45:00.000Z'),
        lastAttemptAt: new Date('2026-08-06T11:45:00.000Z'),
        errorDetails: 'Destination hourly cap (1/hour) reached',
        ruleId: 'rule-1',
        destinationChatId: '111@g.us',
      },
    ]);
    prisma.pipelineDecision.findMany.mockResolvedValue([
      { decisionType: 'forward', createdAt: new Date('2026-08-06T11:20:00.000Z') },
      { decisionType: 'skip', createdAt: new Date('2026-08-06T11:25:00.000Z') },
    ]);
    prisma.reviewItem.findMany.mockResolvedValue([
      { status: 'approved', createdAt: new Date('2026-08-06T11:10:00.000Z') },
    ]);
    prisma.message.findMany.mockResolvedValue([
      { receivedAt: new Date('2026-08-06T11:15:00.000Z') },
    ]);

    const result = await service.getAnalytics(userId, '24h');

    expect(result.window).toBe('24h');
    expect(result.forwards.some((row) => row.sent > 0)).toBe(true);
    expect(result.forwards.some((row) => row.capDeferred > 0)).toBe(true);
    expect(result.pipeline.some((row) => row.forward > 0 || row.skip > 0)).toBe(true);
    expect(result.byRule[0]?.ruleName).toBe('Main rule');

    jest.useRealTimers();
  });
});
