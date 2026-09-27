import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('pipeline')
@UseGuards(JwtAuthGuard)
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get('decisions/:messageId')
  async getDecisions(@Param('messageId') messageId: string, @Req() req: any) {
    return this.pipelineService.getDecisionsForMessage(req.user.userId, messageId);
  }
}
