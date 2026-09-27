<<<<<<< HEAD
import { Controller, Post, Get, Param, Body, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DeliveryService } from './delivery.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('delivery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('send')
  @Roles(UserRole.admin)
  async send(@Body() body: any) {
    return this.deliveryService.send(body);
  }

  @Post('retry/:sendLogId')
  @Roles(UserRole.admin)
  async retry(@Param('sendLogId') sendLogId: string, @Req() req: any) {
    return this.deliveryService.retry(req.user.userId, sendLogId);
  }

  @Get('logs')
  async getLogs(@Req() req: any) {
    return this.deliveryService.getLogs(req.user.userId);
  }

  @Get('inbound')
  async getInbound(@Req() req: any) {
    return this.deliveryService.getInboundMessages(req.user.userId);
  }
}
=======
import { Controller, Post, Get, Param, Body, Req, UseGuards } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('delivery')
@UseGuards(JwtAuthGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('send')
  async send(@Body() body: any) {
    // NOTE: unimplemented stub (pre-existing, not touched this session) — returns
    // its input rather than performing a real send. The guard above still applies,
    // but there's no org-scoping logic here yet since there's no real behavior to
    // scope. Real delivery goes through enqueueDelivery(), called internally from
    // WebhookController, not through this route.
    return this.deliveryService.send(body);
  }

  @Post('retry/:sendLogId')
  async retry(@Param('sendLogId') sendLogId: string, @Req() req: any) {
    return this.deliveryService.retry(req.user.userId, sendLogId);
  }

  @Get('logs')
  async getLogs(@Req() req: any) {
    return this.deliveryService.getLogs(req.user.userId);
  }

  @Get('inbound')
  async getInbound(@Req() req: any) {
    return this.deliveryService.getInboundMessages(req.user.userId);
  }
}
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
