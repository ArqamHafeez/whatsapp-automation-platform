<<<<<<< HEAD
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('throughput')
  @Roles(UserRole.admin)
  async throughput(@Query('window') window: string, @Req() req: any) {
    return this.monitoringService.getThroughput(req.user.userId, window);
  }

  @Get('failure-summary')
  @Roles(UserRole.admin)
  async failureSummary(@Req() req: any) {
    return this.monitoringService.getFailureSummary(req.user.userId);
  }

  @Get('review-summary')
  async reviewSummary(@Req() req: any) {
    return this.monitoringService.getReviewSummary(req.user.userId);
  }

  @Get('connection-health')
  @Roles(UserRole.admin)
  async connectionHealth(@Req() req: any) {
    return this.monitoringService.getConnectionHealth(req.user.userId);
  }

  @Get('analytics')
  @Roles(UserRole.admin)
  async analytics(@Query('window') window: string, @Req() req: any) {
    return this.monitoringService.getAnalytics(req.user.userId, window);
  }
}
=======
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
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
