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
