import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';

@Module({
  imports: [PrismaModule],
  controllers: [RulesController],
  providers: [RulesService],
  exports: [RulesService],  // <-- ADD THIS
})
export class RulesModule {}
