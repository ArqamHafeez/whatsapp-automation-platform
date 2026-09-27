<<<<<<< HEAD
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { ConnectorModule } from './connector/connector.module';
import { ChatsModule } from './chats/chats.module';
import { RulesModule } from './rules/rules.module';
import { AgentsModule } from './agents/agents.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { DeliveryModule } from './delivery/delivery.module';
import { ReviewsModule } from './reviews/reviews.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { UsersModule } from './users/users.module';
import { WebhookController } from './webhook/webhook.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ConnectorModule,
    ChatsModule,
    RulesModule,
    AgentsModule,
    PipelineModule,
    DeliveryModule,
    ReviewsModule,
    MonitoringModule,
    IngestionModule,
  ],
  controllers: [WebhookController],
})
export class AppModule {}
=======
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { ConnectorModule } from './connector/connector.module';
import { ChatsModule } from './chats/chats.module';
import { RulesModule } from './rules/rules.module';
import { AgentsModule } from './agents/agents.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { DeliveryModule } from './delivery/delivery.module';
import { ReviewsModule } from './reviews/reviews.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { WebhookController } from './webhook/webhook.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ConnectorModule,
    ChatsModule,
    RulesModule,
    AgentsModule,
    PipelineModule,
    DeliveryModule,
    ReviewsModule,
    MonitoringModule,
    IngestionModule,
  ],
  controllers: [WebhookController],
})
export class AppModule {}
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
