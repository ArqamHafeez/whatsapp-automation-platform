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
    pipelineDecision: { count: jest.Mock };
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
      pipelineDecision: { count: jest.fn().mockResolvedValue(2) },
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
});
