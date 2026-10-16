import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OpportunityCircleIntegrationService } from './opportunity-circle-integration.service';
import { OpportunityCircleForwardsService } from './opportunity-circle-forwards.service';

class PreviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

class UpdateIntegrationDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sinkChatIds?: string[];

  @IsOptional()
  @IsString()
  primarySinkChatId?: string | null;

  @IsOptional()
  @IsObject()
  categoryByRuleId?: Record<string, string>;

  @IsOptional()
  @IsString()
  defaultCategory?: string | null;
}

@Controller('admin/integrations/opportunity-circle')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class OpportunityCircleAdminController {
  constructor(
    private readonly integrationService: OpportunityCircleIntegrationService,
    private readonly forwardsService: OpportunityCircleForwardsService,
  ) {}

  @Get()
  async get(@Req() req: { user: { userId: string } }) {
    const orgId = await this.integrationService.getUserOrgId(req.user.userId);
    const integration = await this.integrationService.getAdminView(orgId);
    return { ok: true, integration };
  }

  @Patch()
  async update(@Req() req: { user: { userId: string } }, @Body() body: UpdateIntegrationDto) {
    const orgId = await this.integrationService.getUserOrgId(req.user.userId);
    await this.integrationService.updateForOrg(orgId, body);
    const integration = await this.integrationService.getAdminView(orgId);
    return { ok: true, integration };
  }

  @Get('preview')
  async preview(@Req() req: { user: { userId: string } }, @Query() query: PreviewQueryDto) {
    const orgId = await this.integrationService.getUserOrgId(req.user.userId);
    const row = await this.integrationService.getOrCreateForOrg(orgId);
    const preview = await this.forwardsService.previewRecent(row, query.limit ?? 5);
    return { ok: true, preview };
  }

  @Post('rotate-key')
  async rotateKey(@Req() req: { user: { userId: string } }) {
    const orgId = await this.integrationService.getUserOrgId(req.user.userId);
    const { apiKey } = await this.integrationService.rotateKey(orgId);
    return {
      ok: true,
      apiKey,
      message: 'Copy this key into Opportunity Circle now. It will not be shown again.',
    };
  }
}
