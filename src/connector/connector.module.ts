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
