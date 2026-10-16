import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OpportunityCircleKeyGuard } from './opportunity-circle-key.guard';
import { OpportunityCircleRateLimitGuard } from './opportunity-circle-rate-limit.guard';
import { OpportunityCircleForwardsService } from './opportunity-circle-forwards.service';

class ForwardsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@Controller('integrations/opportunity-circle')
export class OpportunityCirclePublicController {
  constructor(private readonly forwardsService: OpportunityCircleForwardsService) {}

  @Get('health')
  @UseGuards(OpportunityCircleKeyGuard, OpportunityCircleRateLimitGuard)
  health(@Req() req: { opportunityCircleIntegration: { enabled: boolean } }) {
    return { ok: true, enabled: req.opportunityCircleIntegration.enabled };
  }

  @Get('forwards')
  @UseGuards(OpportunityCircleKeyGuard, OpportunityCircleRateLimitGuard)
  async forwards(@Req() req: any, @Query() query: ForwardsQueryDto) {
    const integration = req.opportunityCircleIntegration;
    return this.forwardsService.listForwards(integration, {
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}
