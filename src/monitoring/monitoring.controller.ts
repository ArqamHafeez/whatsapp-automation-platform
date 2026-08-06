import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('metrics')
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('throughput')
  async throughput(@Query('window') window: string, @Req() req: any) {
    return this.monitoringService.getThroughput(req.user.userId, window);
  }

  @Get('failure-summary')
  async failureSummary(@Req() req: any) {
    return this.monitoringService.getFailureSummary(req.user.userId);
  }

  @Get('review-summary')
  async reviewSummary(@Req() req: any) {
    return this.monitoringService.getReviewSummary(req.user.userId);
  }

  @Get('connection-health')
  async connectionHealth(@Req() req: any) {
    return this.monitoringService.getConnectionHealth(req.user.userId);
  }
}
