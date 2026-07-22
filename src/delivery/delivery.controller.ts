import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { DeliveryService } from './delivery.service';

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('send')
  async send(@Body() body: any) {
    return this.deliveryService.send(body);
  }

  @Post('retry/:sendLogId')
  async retry(@Param('sendLogId') sendLogId: string) {
    return this.deliveryService.retry(sendLogId);
  }

  @Get('logs')
  async getLogs() {
    return this.deliveryService.getLogs();
  }
}
