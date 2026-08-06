import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { RulesModule } from '../rules/rules.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [PrismaModule, DeliveryModule, RulesModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
