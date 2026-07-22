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
