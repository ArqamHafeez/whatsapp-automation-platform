import { Module } from '@nestjs/common';
import { InboundMessageService } from './inbound-message.service';
import { ReconciliationService } from './reconciliation.service';
import { RulesModule } from '../rules/rules.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { DeliveryModule } from '../delivery/delivery.module';

@Module({
  imports: [RulesModule, PipelineModule, DeliveryModule],
  providers: [InboundMessageService, ReconciliationService],
  exports: [InboundMessageService, ReconciliationService],
})
export class IngestionModule {}
