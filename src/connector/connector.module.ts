<<<<<<< HEAD
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ConnectorController } from './connector.controller';
import { ConnectorService } from './connector.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ConnectorController],
  providers: [ConnectorService],
})
export class ConnectorModule {}
=======
import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ConnectorController } from './connector.controller';
import { ConnectorService } from './connector.service';

@Module({
  imports: [PrismaModule],
  controllers: [ConnectorController],
  providers: [ConnectorService],
})
export class ConnectorModule {}
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
