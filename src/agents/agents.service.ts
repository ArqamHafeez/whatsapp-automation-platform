import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAgents() {
    return { message: 'Agent list not implemented yet' };
  }

  async createAgent(data: any) {
    return { message: 'Create agent not implemented yet', data };
  }

  async getAgent(id: string) {
    return { message: 'Get agent not implemented yet', id };
  }

  async updateAgent(id: string, data: any) {
    return { message: 'Update agent not implemented yet', id, data };
  }
}
