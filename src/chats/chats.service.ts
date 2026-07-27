import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  async listChats(query: any) {
    return { message: 'Chat list not implemented yet', query };
  }

  async updateChat(id: string, data: any) {
    return { message: 'Chat update not implemented yet', id, data };
  }
}
