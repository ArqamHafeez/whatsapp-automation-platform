import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AgentsModule } from '../agents/agents.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';

@Module({
  imports: [PrismaModule, AgentsModule, PipelineModule, forwardRef(() => DeliveryModule)],
  controllers: [RulesController],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
