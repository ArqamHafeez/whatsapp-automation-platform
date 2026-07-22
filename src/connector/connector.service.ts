import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class ConnectorService {
  constructor(private readonly prisma: PrismaService) {}

  async createConnection(userId: string, data: { name: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const connection = await this.prisma.whatsAppConnection.create({
      data: {
        orgId: user.organizationId,
        name: data.name,
        status: 'pending',
        externalId: randomUUID(),
        qrCodeUrl: `https://fake-qr.example.com/${randomUUID()}`,
      },
    });

    return connection;
  }

  async listConnections(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.whatsAppConnection.findMany({ where: { orgId: user.organizationId } });
  }

  async getConnection(userId: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { id, orgId: user.organizationId },
    });
    if (!connection) {
      throw new NotFoundException('Connection not found');
    }

    return connection;
  }

  async refreshQr(userId: string, id: string) {
    const connection = await this.getConnection(userId, id);
    return this.prisma.whatsAppConnection.update({
      where: { id: connection.id },
      data: {
        qrCodeUrl: `https://fake-qr.example.com/${randomUUID()}`,
        status: 'pending',
      },
    });
  }

  async disconnect(userId: string, id: string) {
    const connection = await this.getConnection(userId, id);
    return this.prisma.whatsAppConnection.update({
      where: { id: connection.id },
      data: { status: 'disconnected' },
    });
  }
}
