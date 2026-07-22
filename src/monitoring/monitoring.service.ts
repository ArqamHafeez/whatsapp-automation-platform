import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async getThroughput(window: string) {
    return { message: 'Throughput metrics not implemented yet', window };
  }

  async getFailureSummary() {
    return { message: 'Failure summary not implemented yet' };
  }

  async getReviewSummary() {
    return { message: 'Review summary not implemented yet' };
  }
}
