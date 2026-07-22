import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRules() {
    return { message: 'Rule list not implemented yet' };
  }

  async createRule(data: any) {
    return { message: 'Create rule not implemented yet', data };
  }

  async getRule(id: string) {
    return { message: 'Get rule not implemented yet', id };
  }

  async updateRule(id: string, data: any) {
    return { message: 'Update rule not implemented yet', id, data };
  }

  async deleteRule(id: string) {
    return { message: 'Delete rule not implemented yet', id };
  }
}
