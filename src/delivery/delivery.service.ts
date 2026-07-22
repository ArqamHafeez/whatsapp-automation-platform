import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async send(data: any) {
    return { message: 'Delivery send not implemented yet', data };
  }

  async retry(sendLogId: string) {
    return { message: 'Delivery retry not implemented yet', sendLogId };
  }

  async getLogs() {
    return { message: 'Delivery logs not implemented yet' };
  }
}
