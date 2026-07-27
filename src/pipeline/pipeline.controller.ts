import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { PipelineService } from './pipeline.service';

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post('process')
  async processMessage(@Body() body: any) {
    return this.pipelineService.processMessage(body);
  }

  @Get('decisions/:messageId')
  async getDecision(@Param('messageId') messageId: string) {
    return this.pipelineService.getDecision(messageId);
  }
}
