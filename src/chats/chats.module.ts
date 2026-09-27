<<<<<<< HEAD
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ChatsController],
  providers: [ChatsService],
})
export class ChatsModule {}
=======
import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';

@Module({
  imports: [PrismaModule],
  controllers: [ChatsController],
  providers: [ChatsService],
})
export class ChatsModule {}
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
