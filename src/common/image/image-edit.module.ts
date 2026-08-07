import { Module } from '@nestjs/common';
import { ImageEditService } from './image-edit.service';

@Module({
  providers: [ImageEditService],
  exports: [ImageEditService],
})
export class ImageEditModule {}
