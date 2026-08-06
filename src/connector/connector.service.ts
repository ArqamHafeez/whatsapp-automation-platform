import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getWahaConfig } from '../common/waha/waha.config';
import { fetchWahaQrBuffer } from '../common/waha/waha-qr';
import {
  isWahaSessionWorking,
  mapWahaStatusToConnection,
  wahaDeleteSession,
  wahaEnsureSession,
  wahaFetchSession,
  wahaFetchSessionDetailed,
  wahaListSessions,
  wahaRestartSession,
  wahaStartSession,
  wahaUpdateSessionWebhooks,
} from '../common/waha/waha-session';
import { getWahaWebhookConfig } from '../common/waha/waha-webhook';
import { randomUUID } from 'crypto';

type ConnectionRecord = {
  id: string;
  externalId?: string | null;
  qrCodeUrl?: string | null;
  status?: string;
  wahaStatus?: string | null;
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
  private readonly logger = new Logger(ConnectorService.name);
  private wahaBaseUrl: string;
  private wahaApiKey: string;

  constructor(private readonly prisma: PrismaService) {
    const { baseUrl, apiKey } = getWahaConfig();
    this.wahaBaseUrl = baseUrl;
    this.wahaApiKey = apiKey;
    this.logger.log(`WAHA API target: ${baseUrl}`);
  }

  async registerWebhook(userId: string, connectionId: string) {
    const webhook = getWahaWebhookConfig();
    if (!webhook) {
      throw new BadRequestException(
        'WEBHOOK_PUBLIC_URL is not set. Point it at your public Nest URL (e.g. Cloudflare Tunnel or ngrok) before registering webhooks.',
      );
    }

    const prismaWithConnection = this.prisma as PrismaWithWhatsApp;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const connection = await prismaWithConnection.whatsAppConnection.findFirst({
      where: { id: connectionId, orgId: user.organizationId },
    });
    if (!connection?.externalId) {
      throw new NotFoundException('Connection not found or missing WAHA session name');
    }

    const sessionName = connection.externalId;

    const wahaSession = await wahaFetchSession(sessionName);
    if (!wahaSession) {
      throw new BadRequestException(
        `WAHA session "${sessionName}" not found. Ensure WAHA is running and externalId matches the session name (e.g. "default").`,
      );
    }

    try {
      await wahaUpdateSessionWebhooks(sessionName);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown WAHA error';
      this.logger.error(`registerWebhook ${sessionName}: ${detail}`);
      throw new BadRequestException(`WAHA did not accept webhook registration: ${detail}`);
    }

    this.logger.log(`Webhook registered for ${sessionName} → ${webhook.url}`);
    return {
      ok: true,
      session: sessionName,
      webhookUrl: webhook.url,
    };
  }

  /** @deprecated Use registerWebhook */
  async registerEvolutionWebhook(userId: string, connectionId: string) {
    return this.registerWebhook(userId, connectionId);
  }

  private async applyConnectionState(connection: ConnectionRecord): Promise<ConnectionRecord> {
    if (!connection.externalId) {
      return connection;
    }

    const fetched = await wahaFetchSessionDetailed(connection.externalId);
    if (fetched.error) {
      this.logger.warn(`applyConnectionState ${connection.externalId}: ${fetched.error}`);
      return { ...connection, wahaStatus: fetched.error };
    }

    const session = fetched.session;
    if (!session) {
      return connection;
    }

    const wahaStatus = String(session.status);
    const mapped = mapWahaStatusToConnection(session.status);
    const prismaWithConnection = this.prisma as PrismaWithWhatsApp;

    if (isWahaSessionWorking(session) && connection.status !== 'connected') {
      this.logger.log(`Session ${connection.externalId} connected (WORKING)`);
      const updated = await prismaWithConnection.whatsAppConnection.update({
        where: { id: connection.id },
        data: { status: 'connected', qrCodeUrl: null, lastSeenAt: new Date() },
      });
      return { ...updated, wahaStatus };
    }

    if (mapped === 'disconnected' && connection.status === 'connected') {
      const updated = await prismaWithConnection.whatsAppConnection.update({
        where: { id: connection.id },
        data: { status: 'pending' },
      });
      return { ...updated, wahaStatus };
    }

    return { ...connection, wahaStatus };
  }

  private async markConnectionConnected(connection: ConnectionRecord): Promise<ConnectionRecord> {
    const prismaWithConnection = this.prisma as PrismaWithWhatsApp;
    const updated = await prismaWithConnection.whatsAppConnection.update({
      where: { id: connection.id },
      data: {
        qrCodeUrl: null,
        status: 'connected',
        lastSeenAt: new Date(),
      },
    });
    return { ...updated, wahaStatus: 'WORKING' };
  }

  private async resolveWahaSessionForConnection(externalId: string) {
    let fetched = await wahaFetchSessionDetailed(externalId);
    if (fetched.error) {
      return { session: null as Awaited<ReturnType<typeof wahaFetchSessionDetailed>>['session'], error: fetched.error };
    }

    let session = fetched.session;
    if (!session) {
      return { session: null, error: `WAHA session "${externalId}" not found` };
    }

    let status = String(session.status).toUpperCase();
    if (status === 'FAILED' || status === 'STOPPED') {
      try {
        if (status === 'FAILED') {
          await wahaRestartSession(externalId);
        } else {
          await wahaStartSession(externalId);
        }
        await this.sleep(2500);
        fetched = await wahaFetchSessionDetailed(externalId);
        session = fetched.session ?? session;
        status = String(session.status).toUpperCase();
      } catch (err) {
        this.logger.warn(`resolveWahaSession ${externalId}: ${(err as Error).message}`);
      }
    }

    return { session, error: null as string | null };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private toPublicConnection(connection: ConnectionRecord & { name?: string }) {
    const { qrCodeUrl, ...rest } = connection as ConnectionRecord & {
      name?: string;
      orgId?: string;
      createdAt?: Date;
      updatedAt?: Date;
    };
    return {
      ...rest,
      hasQr: connection.status === 'pending' && Boolean(connection.externalId),
      wahaStatus: connection.wahaStatus ?? null,
    };
  }

  async createConnection(userId: string, data: { name: string }) {
    this.logger.log(`createConnection requested name="${data.name}"`);
    const prismaWithConnection = this.prisma as PrismaWithWhatsApp;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const displayName = data.name?.trim();
    if (!displayName) {
      throw new BadRequestException('Connection name is required');
    }

    const sanitized = displayName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
    const sessionName =
      sanitized.length > 0 ? sanitized.slice(0, 80) : `wa-${randomUUID().replace(/-/g, '').slice(0, 12)}`;

    let externalId = sessionName;
    let qrCodeUrl: string | null = null;
    let initialStatus: 'connected' | 'pending' = 'pending';

    const existingDb = await prismaWithConnection.whatsAppConnection.findFirst({
      where: { orgId: user.organizationId, externalId: sessionName },
    });
    if (existingDb && existingDb.status !== 'disconnected') {
      throw new BadRequestException(
        `A connection for WAHA session "${sessionName}" already exists in the dashboard.`,
      );
    }

    try {
      const session = await wahaEnsureSession(sessionName, { start: true, withWebhook: true });
      externalId = session.name || sessionName;
      this.logger.log(`WAHA session ready: ${externalId} status=${session.status}`);

      if (isWahaSessionWorking(session)) {
        initialStatus = 'connected';
      } else if (String(session.status).toUpperCase() === 'SCAN_QR_CODE') {
        const qr = await fetchWahaQrBuffer(this.wahaBaseUrl, this.wahaApiKey, externalId);
        qrCodeUrl = qr?.dataUrl ?? null;
        if (!qrCodeUrl) {
          this.logger.warn(`WAHA returned no usable QR for ${externalId}`);
        }
      }

      const webhook = getWahaWebhookConfig();
      if (webhook && isWahaSessionWorking(session)) {
        try {
          await wahaUpdateSessionWebhooks(externalId);
        } catch (err) {
          this.logger.warn(`Webhook attach on create ${externalId}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(`WAHA unreachable: ${(err as Error).message}`);
      throw new BadRequestException(
        'Could not reach WAHA API. Check WAHA_API_URL (or WAHA_BASE_URL) and WAHA_API_KEY, and that the server is reachable from this host.',
      );
    }

    if (existingDb?.status === 'disconnected') {
      const revived = await prismaWithConnection.whatsAppConnection.update({
        where: { id: existingDb.id },
        data: {
          name: displayName,
          status: initialStatus,
          externalId,
          qrCodeUrl: initialStatus === 'connected' ? null : qrCodeUrl,
          lastSeenAt: initialStatus === 'connected' ? new Date() : null,
        },
      });
      return this.toPublicConnection({ ...revived, wahaStatus: initialStatus === 'connected' ? 'WORKING' : null });
    }

    const connection = await prismaWithConnection.whatsAppConnection.create({
      data: {
        orgId: user.organizationId,
        name: displayName,
        status: initialStatus,
        externalId,
        qrCodeUrl: initialStatus === 'connected' ? null : qrCodeUrl,
        lastSeenAt: initialStatus === 'connected' ? new Date() : null,
      },
    });

    return this.toPublicConnection({
      ...connection,
      wahaStatus: initialStatus === 'connected' ? 'WORKING' : null,
    });
  }

  async listConnections(userId: string) {
    const prismaWithConnection = this.prisma as PrismaWithWhatsApp;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const connections = await prismaWithConnection.whatsAppConnection.findMany({
      where: { orgId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    const synced = await Promise.all(
      connections.map((connection) =>
        connection.externalId && connection.status !== 'disconnected'
          ? this.applyConnectionState(connection)
          : Promise.resolve(connection),
      ),
    );

    return synced.map((connection) => this.toPublicConnection(connection));
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

    const synced =
      connection.externalId && connection.status !== 'disconnected'
        ? await this.applyConnectionState(connection)
        : connection;

    return this.toPublicConnection(synced);
  }

  async getQrImage(userId: string, id: string): Promise<{ buffer: Buffer; mime: string }> {
    this.logger.log(`getQrImage connectionId=${id}`);
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

    if (!connection.externalId) {
      throw new NotFoundException('QR not available for this connection state');
    }

    const session = await wahaFetchSession(connection.externalId);
    if (session && String(session.status).toUpperCase() === 'WORKING') {
      await prismaWithConnection.whatsAppConnection.update({
        where: { id: connection.id },
        data: { status: 'connected', qrCodeUrl: null, lastSeenAt: new Date() },
      });
      throw new NotFoundException('WhatsApp is already linked for this connection');
    }

    const sessionStatus = String(session?.status ?? '').toUpperCase();
    if (sessionStatus === 'FAILED' || sessionStatus === 'STOPPED') {
      try {
        await wahaStartSession(connection.externalId);
      } catch (err) {
        this.logger.warn(`getQrImage start session: ${(err as Error).message}`);
      }
    }

    const synced = await this.applyConnectionState(connection);
    if (synced.status === 'connected') {
      throw new NotFoundException('WhatsApp is already linked for this connection');
    }
    if (synced.status !== 'pending' || !synced.externalId) {
      throw new NotFoundException('QR not available for this connection state');
    }

    const image = await fetchWahaQrBuffer(this.wahaBaseUrl, this.wahaApiKey, synced.externalId);

    if (!image) {
      this.logger.warn(`getQrImage failed for ${synced.externalId}`);
      throw new NotFoundException('QR code not available — try Refresh QR');
    }

    if (image.dataUrl) {
      await prismaWithConnection.whatsAppConnection.update({
        where: { id: synced.id },
        data: { qrCodeUrl: image.dataUrl },
      });
    }

    this.logger.log(`getQrImage ${synced.externalId}: ${image.mime} ${image.buffer.length} bytes`);
    return { buffer: image.buffer, mime: image.mime };
  }

  async refreshQr(userId: string, id: string) {
    this.logger.log(`refreshQr connectionId=${id}`);
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

    if (!connection.externalId) {
      throw new BadRequestException('Connection has no externalId');
    }

    try {
      const { session, error } = await this.resolveWahaSessionForConnection(connection.externalId);
      if (error) {
        throw new BadRequestException(error);
      }

      if (isWahaSessionWorking(session)) {
        const updated = await this.markConnectionConnected(connection);
        this.logger.log(`refreshQr ${connection.externalId}: WAHA WORKING → connected`);
        return this.toPublicConnection(updated);
      }

      const status = String(session?.status ?? '').toUpperCase();
      if (status !== 'SCAN_QR_CODE' && status !== 'STARTING') {
        const workingElsewhere = (await wahaListSessions()).filter((s) => isWahaSessionWorking(s));
        const hint =
          workingElsewhere.length > 0
            ? ` Phone may be linked to WAHA session "${workingElsewhere[0].name}" instead of "${connection.externalId}".`
            : '';
        throw new BadRequestException(
          `WAHA session "${connection.externalId}" is ${status || 'unknown'}, not linked yet.${hint}`,
        );
      }

      const fresh = await fetchWahaQrBuffer(this.wahaBaseUrl, this.wahaApiKey, connection.externalId);
      const qrCodeUrl = fresh?.dataUrl ?? null;

      if (!qrCodeUrl) {
        this.logger.warn(`refreshQr failed for ${connection.externalId} (status=${status})`);
        throw new BadRequestException(
          `WAHA did not return a scannable QR (session status: ${status}). Wait a few seconds and click Check status / QR again.`,
        );
      }

      const updated = await prismaWithConnection.whatsAppConnection.update({
        where: { id: connection.id },
        data: {
          qrCodeUrl,
          status: 'pending',
        },
      });
      return this.toPublicConnection(updated);
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(`refreshQr error: ${(err as Error).message}`);
      throw new BadRequestException('Failed to refresh QR on WAHA server');
    }
  }

  async disconnect(userId: string, id: string) {
    const prismaWithConnection = this.prisma as PrismaWithWhatsApp;
    const connection = await this.getConnection(userId, id);

    try {
      if (connection.externalId) {
        await wahaDeleteSession(connection.externalId);
      }
    } catch (err) {
      console.error('Failed to delete session on WAHA server:', err);
    }

    return prismaWithConnection.whatsAppConnection.update({
      where: { id: connection.id },
      data: { status: 'disconnected' },
    });
  }
}
