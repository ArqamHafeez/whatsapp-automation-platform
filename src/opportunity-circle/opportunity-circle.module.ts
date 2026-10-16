import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { OpportunityCircleAdminController } from './opportunity-circle-admin.controller';
import { OpportunityCirclePublicController } from './opportunity-circle.controller';
import { OpportunityCircleForwardsService } from './opportunity-circle-forwards.service';
import { OpportunityCircleIntegrationService } from './opportunity-circle-integration.service';
import { OpportunityCircleKeyGuard } from './opportunity-circle-key.guard';
import { OpportunityCircleRateLimitGuard } from './opportunity-circle-rate-limit.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OpportunityCirclePublicController, OpportunityCircleAdminController],
  providers: [
    OpportunityCircleIntegrationService,
    OpportunityCircleForwardsService,
    OpportunityCircleKeyGuard,
    OpportunityCircleRateLimitGuard,
  ],
  exports: [OpportunityCircleIntegrationService, OpportunityCircleForwardsService],
})
export class OpportunityCircleModule {}
