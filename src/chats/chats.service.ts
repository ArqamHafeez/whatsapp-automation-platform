import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../common/prisma/prisma.service';

import {

  formatChatDisplayLabel,

  resolveChatTitleFromEvolutionPayload,

} from '../common/whatsapp/chat-display';

import { fetchWahaChatListDetailed } from '../common/waha/waha-chats';

import { resolveCanonicalChatJid } from '../common/whatsapp/jid-canonical';
import { collectRemoteJidAliases } from '../common/whatsapp/inbound-chat-jid';



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

  description?: string;

}



@Injectable()

export class ChatsService {

  constructor(private readonly prisma: PrismaService) {}



  private async getUserOrgId(userId: string): Promise<string> {

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {

      throw new NotFoundException('User not found');

    }

    return user.organizationId;

  }



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

    }).then((rows) =>

      rows.map((row) => ({

        ...row,

        title: formatChatDisplayLabel({

          title: row.title,

          externalChatId: row.externalChatId,

          type: row.type,

          metadata: row.metadata,

        }),

      })),

    );

  }



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



    const fetched = await fetchWahaChatListDetailed(connection.externalId);

    const remoteRaw = fetched.chats;

    const senderNamesByChatId = await this.buildSenderNamesByChatId(connection.id);



    const synced = [];



    for (const remote of remoteRaw) {

      const jid = String(remote.id ?? remote.chatId ?? remote.jid ?? '');

      if (!jid) continue;



      const storedJid = resolveCanonicalChatJid(remote, jid);

      const rawType = storedJid.endsWith('@g.us')

        ? 'GROUP'

        : storedJid.endsWith('@newsletter')

          ? 'CHANNEL'

          : 'CHAT';

      const mappedType = this.mapChatType(rawType);



      const senderFallback =

        senderNamesByChatId.get(storedJid) ||

        senderNamesByChatId.get(jid) ||

        null;



      const title = resolveChatTitleFromEvolutionPayload(remote, storedJid, mappedType, senderFallback);



      const metadata = {
        ...remote,
        sourceRemoteJid: jid,
        canonicalRemoteJid: storedJid,
        alternateJids: collectRemoteJidAliases(remote, jid, storedJid),
      };



      const chat = await this.prisma.chat.upsert({

        where: {

          connectionId_externalChatId: {

            connectionId: connection.id,

            externalChatId: storedJid,

          },

        },

        update: {

          title,

          type: mappedType,

          metadata: metadata as object,

        },

        create: {

          connectionId: connection.id,

          externalChatId: storedJid,

          type: mappedType,

          title,

          metadata: metadata as object,

        },

      });



      if (storedJid !== jid) {

        await this.prisma.chat.deleteMany({

          where: { connectionId: connection.id, externalChatId: jid },

        });

      }

      synced.push({

        ...chat,

        title: formatChatDisplayLabel({

          title: chat.title,

          externalChatId: chat.externalChatId,

          type: chat.type,

          metadata: chat.metadata,

        }),

      });

    }



    return {

      connectionId: connection.id,

      syncedCount: synced.length,

      wahaSources: {
        overview: fetched.overviewCount,
        allChats: fetched.allChatsCount,
        groups: fetched.groupsCount,
        channels: fetched.channelsCount,
        merged: fetched.mergedCount,
      },

      hint:
        synced.length === 0
          ? 'WAHA returned no chats. Ensure NOWEB store is enabled (fullSync: true before QR scan), wait 1–2 minutes after linking, then sync again.'
          : fetched.mergedCount < 20
            ? 'If chats are missing, wait for NOWEB store sync to finish and click Sync again. WAHA may not mirror every chat on your phone immediately.'
            : undefined,

      chats: synced,

    };

  }



  private mapChatType(rawType?: string): ChatTypeValue {

    const normalized = (rawType || '').toUpperCase();

    if (normalized === 'GROUP') return 'GROUP';

    if (normalized === 'CHANNEL') return 'CHANNEL';

    return 'CHAT';

  }



  private async buildSenderNamesByChatId(connectionId: string): Promise<Map<string, string>> {

    const map = new Map<string, string>();

    const rows = await this.prisma.message.findMany({

      where: { connectionId },

      orderBy: { receivedAt: 'desc' },

      take: 400,

      select: { chatId: true, sender: true },

    });

    for (const row of rows) {

      if (map.has(row.chatId)) {

        continue;

      }

      const sender = row.sender?.trim();

      if (!sender || sender === 'unknown' || /^\d+$/.test(sender)) {

        continue;

      }

      map.set(row.chatId, sender);

    }

    return map;

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

    if (data.description !== undefined) updateData.description = data.description.trim() || null;



    if (Object.keys(updateData).length === 0) {

      throw new BadRequestException('Provide isSource, isDestination, and/or description to update');

    }



    return this.prisma.chat.update({

      where: { id },

      data: updateData,

    });

  }

}

