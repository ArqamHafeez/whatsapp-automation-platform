import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

// Mirrors the `ChatType` enum in schema.prisma. Kept as a literal union rather than
// importing the generated enum, since the generated client's enum export isn't
// guaranteed to be present in every build environment (e.g. sandboxes without
// network access to download Prisma's query engine).
type ChatTypeValue = 'CHAT' | 'GROUP' | 'CHANNEL';

interface ListChatsQuery {
  connectionId?: string;
  type?: string;
  isSource?: string;
  isDestination?: string;
}

interface UpdateChatData {
  isSource?: boolean;
  isDestination?: boolean;
}

@Injectable()
export class ChatsService {
  private evolutionBaseUrl: string;

  constructor(private readonly prisma: PrismaService) {
    this.evolutionBaseUrl = process.env.EVOLUTION_BASE_URL || 'http://localhost:3001';
  }

  private async getUserOrgId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.organizationId;
  }

  /**
   * Lists chats already synced into the local DB, scoped to the caller's org.
   * Does NOT hit Evolution API — call syncChats() first to pull fresh data.
   */
  async listChats(userId: string, query: ListChatsQuery) {
    const orgId = await this.getUserOrgId(userId);

    const where: Record<string, unknown> = {
      connection: { orgId },
    };
    if (query.connectionId) where.connectionId = query.connectionId;
    if (query.type) where.type = query.type;
    if (query.isSource !== undefined) where.isSource = query.isSource === 'true';
    if (query.isDestination !== undefined) where.isDestination = query.isDestination === 'true';

    return this.prisma.chat.findMany({
      where,
      orderBy: { title: 'asc' },
    });
  }

  /**
   * Pulls the chat/group/channel list from Evolution API for a given connection
   * and upserts it into the local Chat table. Existing isSource/isDestination
   * flags are preserved on update (sync never resets user-made marking).
   */
  async syncChats(userId: string, connectionId: string) {
    const orgId = await this.getUserOrgId(userId);

    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { id: connectionId, orgId },
    });
    if (!connection) {
      throw new NotFoundException('Connection not found');
    }
    if (!connection.externalId) {
      throw new BadRequestException('Connection has no externalId yet — complete pairing first');
    }

    let evolutionResponse: { status?: string; data?: unknown[] };
    try {
      const res = await fetch(
        `${this.evolutionBaseUrl}/api/instances/${connection.externalId}/chats`,
        {
          headers: {
            Authorization: `Bearer ${process.env.EVOLUTION_API_KEY || 'dev-key'}`,
          },
        },
      );
      if (!res.ok) {
        throw new Error(`Evolution API responded with status ${res.status}`);
      }
      evolutionResponse = await res.json();
    } catch (err) {
      throw new BadRequestException('Failed to fetch chats from Evolution server');
    }

    const remoteChats = (evolutionResponse?.data ?? []) as Array<{
      id: string;
      name?: string;
      type?: string;
      [key: string]: unknown;
    }>;

    const synced = [];
    for (const remote of remoteChats) {
      if (!remote?.id) continue;

      const chat = await this.prisma.chat.upsert({
        where: {
          connectionId_externalChatId: {
            connectionId: connection.id,
            externalChatId: String(remote.id),
          },
        },
        update: {
          title: remote.name ?? undefined,
          type: this.mapChatType(remote.type),
          metadata: remote as object,
        },
        create: {
          connectionId: connection.id,
          externalChatId: String(remote.id),
          type: this.mapChatType(remote.type),
          title: remote.name ?? null,
          metadata: remote as object,
        },
      });
      synced.push(chat);
    }

    return {
      connectionId: connection.id,
      syncedCount: synced.length,
      chats: synced,
    };
  }

  private mapChatType(rawType?: string): ChatTypeValue {
    const normalized = (rawType || '').toUpperCase();
    if (normalized === 'GROUP') return 'GROUP';
    if (normalized === 'CHANNEL') return 'CHANNEL';
    return 'CHAT';
  }

  async updateChat(userId: string, id: string, data: UpdateChatData) {
    const orgId = await this.getUserOrgId(userId);

    const chat = await this.prisma.chat.findFirst({
      where: { id, connection: { orgId } },
    });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const updateData: UpdateChatData = {};
    if (data.isSource !== undefined) updateData.isSource = data.isSource;
    if (data.isDestination !== undefined) updateData.isDestination = data.isDestination;

    return this.prisma.chat.update({
      where: { id },
      data: updateData,
    });
  }
}
