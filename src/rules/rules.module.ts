import { Module, forwardRef } from '@nestjs/common';
<<<<<<< HEAD
import { AuthModule } from '../auth/auth.module';
=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
import { PrismaModule } from '../common/prisma/prisma.module';
import { AgentsModule } from '../agents/agents.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';

@Module({
<<<<<<< HEAD
  imports: [PrismaModule, AuthModule, AgentsModule, PipelineModule, forwardRef(() => DeliveryModule)],
=======
  imports: [PrismaModule, AgentsModule, PipelineModule, forwardRef(() => DeliveryModule)],
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
  controllers: [RulesController],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
