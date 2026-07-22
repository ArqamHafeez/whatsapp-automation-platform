import { Controller, Get, Query } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';

@Controller('metrics')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('throughput')
  async throughput(@Query('window') window: string) {
    return this.monitoringService.getThroughput(window);
  }

  @Get('failure-summary')
  async failureSummary() {
    return this.monitoringService.getFailureSummary();
  }

  @Get('review-summary')
  async reviewSummary() {
    return this.monitoringService.getReviewSummary();
  }
}
