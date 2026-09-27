import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { AuthModule } from '../auth/auth.module';
=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';

@Module({
<<<<<<< HEAD
  imports: [AuthModule],
  providers: [DeliveryService],
  controllers: [DeliveryController],
  exports: [DeliveryService],
=======
  providers: [DeliveryService],
  controllers: [DeliveryController],
  exports: [DeliveryService],  // <-- ADD THIS
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
})
export class DeliveryModule {}
