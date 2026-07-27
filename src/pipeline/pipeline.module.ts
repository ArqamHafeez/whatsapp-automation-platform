import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [PrismaModule],
  controllers: [PipelineController],
  providers: [PipelineService],
})
export class PipelineModule {}
