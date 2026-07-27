import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { randomUUID } from 'crypto';

type ConnectionRecord = {
  id: string;
  externalId?: string | null;
  qrCodeUrl?: string | null;
};

type PrismaWithWhatsApp = PrismaService & {
  whatsAppConnection: {
    create: (args: unknown) => Promise<ConnectionRecord>;
    findMany: (args: unknown) => Promise<ConnectionRecord[]>;
    findFirst: (args: unknown) => Promise<ConnectionRecord | null>;
    update: (args: unknown) => Promise<ConnectionRecord>;
  };
};

@Injectable()
export class ConnectorService {
  private evolutionBaseUrl: string;

  constructor(private readonly prisma: PrismaService) {
    this.evolutionBaseUrl = process.env.EVOLUTION_BASE_URL || 'http://localhost:3001';
  }

  async createConnection(userId: string, data: { name: string }) {
    const prismaWithConnection = this.prisma as PrismaWithWhatsApp;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Call Evolution API to create instance
    let evolutionResponse;
    try {
      const res = await fetch(`${this.evolutionBaseUrl}/api/instances/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EVOLUTION_API_KEY || 'dev-key'}`,
        },
        body: JSON.stringify({ name: data.name }),
      });
      evolutionResponse = await res.json();
    } catch (err) {
      throw new BadRequestException('Failed to create connection on Evolution server');
    }

    const externalId = evolutionResponse.data?.externalId || randomUUID();
    const qrCodeUrl = evolutionResponse.data?.qrcode || `https://fake-qr.example.com/${randomUUID()}`;

    const connection = await prismaWithConnection.whatsAppConnection.create({
      data: {
        orgId: user.organizationId,
        name: data.name,
        status: 'pending',
        externalId,
        qrCodeUrl,
      },
    });

    return connection;
  }

  async listConnections(userId: string) {
    const prismaWithConnection = this.prisma as PrismaWithWhatsApp;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return prismaWithConnection.whatsAppConnection.findMany({ where: { orgId: user.organizationId } });
  }

  async getConnection(userId: string, id: string) {
    const prismaWithConnection = this.prisma as PrismaWithWhatsApp;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const connection = await prismaWithConnection.whatsAppConnection.findFirst({
      where: { id, orgId: user.organizationId },
    });
    if (!connection) {
      throw new NotFoundException('Connection not found');
    }

    return connection;
  }

  async refreshQr(userId: string, id: string) {
    const prismaWithConnection = this.prisma as PrismaWithWhatsApp;
    const connection = await this.getConnection(userId, id);

    // Call Evolution API to refresh QR
    try {
      const res = await fetch(`${this.evolutionBaseUrl}/api/instances/${connection.externalId}/qrcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EVOLUTION_API_KEY || 'dev-key'}`,
        },
      });
      const evolutionResponse = await res.json();
      const qrCodeUrl = evolutionResponse.data?.qrcode || connection.qrCodeUrl;

      return prismaWithConnection.whatsAppConnection.update({
        where: { id: connection.id },
        data: {
          qrCodeUrl,
          status: 'pending',
        },
      });
    } catch (err) {
      throw new BadRequestException('Failed to refresh QR on Evolution server');
    }
  }

  async disconnect(userId: string, id: string) {
    const prismaWithConnection = this.prisma as PrismaWithWhatsApp;
    const connection = await this.getConnection(userId, id);

    // Call Evolution API to disconnect
    try {
      await fetch(`${this.evolutionBaseUrl}/api/instances/${connection.externalId}/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EVOLUTION_API_KEY || 'dev-key'}`,
        },
      });
    } catch (err) {
      // Log but continue with local disconnect
      console.error('Failed to disconnect on Evolution server:', err);
    }

    return prismaWithConnection.whatsAppConnection.update({
      where: { id: connection.id },
      data: { status: 'disconnected' },
    });
  }
}
