import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  async processMessage(data: any) {
    return { message: 'Pipeline processing not implemented yet', data };
  }

  async getDecision(messageId: string) {
    return { message: 'Pipeline decision lookup not implemented yet', messageId };
  }
}
