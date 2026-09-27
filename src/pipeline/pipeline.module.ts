<<<<<<< HEAD
import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AiModule } from '../common/ai/ai.module';
import { ImageEditModule } from '../common/image/image-edit.module';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [PrismaModule, AiModule, ImageEditModule],
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
=======
import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AiModule } from '../common/ai/ai.module';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
