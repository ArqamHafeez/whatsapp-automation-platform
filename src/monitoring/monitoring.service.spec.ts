import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringService } from './monitoring.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let prisma: { sendLog: { findMany: jest.Mock }; pipelineDecision: { findMany: jest.Mock }; reviewItem: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      sendLog: { findMany: jest.fn() },
      pipelineDecision: { findMany: jest.fn() },
      reviewItem: { findMany: jest.fn() },
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
      { status: 'sent', createdAt: new Date('2026-07-24T10:00:00.000Z') },
      { status: 'failed', createdAt: new Date('2026-07-24T10:05:00.000Z') },
      { status: 'sent', createdAt: new Date('2026-07-24T10:10:00.000Z') },
    ]);

    const result = await service.getThroughput('1h');

    expect(result.window).toBe('1h');
    expect(result.total).toBe(3);
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.successRate).toBe(66.67);
  });

  it('returns a failure summary with counts by reason', async () => {
    prisma.sendLog.findMany.mockResolvedValue([
      { status: 'failed', errorDetails: 'Rate limit exceeded' },
      { status: 'failed', errorDetails: 'Rate limit exceeded' },
      { status: 'failed', errorDetails: 'Timeout' },
    ]);

    const result = await service.getFailureSummary();

    expect(result.total).toBe(3);
    expect(result.byReason).toEqual({
      'Rate limit exceeded': 2,
      Timeout: 1,
    });
  });

  it('returns review summary metrics', async () => {
    prisma.reviewItem.findMany.mockResolvedValue([
      { status: 'pending' },
      { status: 'approved' },
      { status: 'rejected' },
    ]);

    const result = await service.getReviewSummary();

    expect(result.total).toBe(3);
    expect(result.pending).toBe(1);
    expect(result.approved).toBe(1);
    expect(result.rejected).toBe(1);
  });
});
