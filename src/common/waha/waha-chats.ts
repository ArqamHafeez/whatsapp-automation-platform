import { Logger } from '@nestjs/common';
import { getWahaConfig, wahaHeaders } from './waha.config';

const logger = new Logger('WahaChats');

export type WahaRemoteChat = Record<string, unknown> & {
  id?: string;
  chatId?: string;
  jid?: string;
  name?: string;
  picture?: string;
};

const PAGE_SIZE = 100;

function isChatLikeRow(value: unknown): value is WahaRemoteChat {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const row = value as WahaRemoteChat;
  return Boolean(row.id || row.chatId || row.jid || row.subject || row.name);
}

function normalizeChatRows(body: unknown): WahaRemoteChat[] {
  if (Array.isArray(body)) {
    return body;
  }
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const nested = obj.data ?? obj.chats ?? obj.items ?? obj.results;
    if (Array.isArray(nested)) {
      return nested;
    }
    // WAHA NOWEB GET /groups returns { "120363...@g.us": { id, subject, ... }, ... }
    const values = Object.values(obj);
    if (values.length > 0 && values.every(isChatLikeRow)) {
      return values.map((row) => ({
        ...row,
        id: row.id ?? row.chatId ?? row.jid,
      }));
    }
  }
  return [];
}

function chatRowId(row: WahaRemoteChat): string {
  return String(row.id ?? row.chatId ?? row.jid ?? '').trim();
}

function mergeChatRows(into: Map<string, WahaRemoteChat>, rows: WahaRemoteChat[]): void {
  for (const row of rows) {
    const id = chatRowId(row);
    if (!id) {
      continue;
    }
    const existing = into.get(id);
    into.set(id, existing ? { ...existing, ...row, id } : { ...row, id });
  }
}

/** Paginated GET /api/{session}/chats/overview */
export async function fetchWahaChatsOverview(sessionName: string): Promise<WahaRemoteChat[]> {
  const { baseUrl, apiKey } = getWahaConfig();
  const all: WahaRemoteChat[] = [];
  let offset = 0;

  try {
    for (let page = 0; page < 50; page += 1) {
      const url = `${baseUrl}/api/${encodeURIComponent(sessionName)}/chats/overview?limit=${PAGE_SIZE}&offset=${offset}`;
      const res = await fetch(url, {
        headers: wahaHeaders(apiKey),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        logger.warn(`chats/overview ${sessionName} HTTP ${res.status} offset=${offset}`);
        break;
      }

      const rows = normalizeChatRows(await res.json());
      if (rows.length === 0) {
        break;
      }

      all.push(...rows);
      if (rows.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }
  } catch (err) {
    logger.warn(`chats/overview failed: ${(err as Error).message}`);
  }

  return all;
}

/** GET /api/{session}/chats — full chat list from NOWEB store */
export async function fetchWahaAllChats(sessionName: string): Promise<WahaRemoteChat[]> {
  const { baseUrl, apiKey } = getWahaConfig();
  const url = `${baseUrl}/api/${encodeURIComponent(sessionName)}/chats`;

  try {
    const res = await fetch(url, {
      headers: wahaHeaders(apiKey),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      logger.warn(`chats ${sessionName} HTTP ${res.status}`);
      return [];
    }

    return normalizeChatRows(await res.json());
  } catch (err) {
    logger.warn(`chats list failed: ${(err as Error).message}`);
    return [];
  }
}

/** GET /api/{session}/groups/{groupId} — live group metadata (subject may be fresher than list cache). */
export async function fetchWahaGroupById(
  sessionName: string,
  groupId: string,
): Promise<WahaRemoteChat | null> {
  const { baseUrl, apiKey } = getWahaConfig();
  const url = `${baseUrl}/api/${encodeURIComponent(sessionName)}/groups/${encodeURIComponent(groupId)}?exclude=participants`;

  try {
    const res = await fetch(url, {
      headers: wahaHeaders(apiKey),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      logger.warn(`group ${sessionName}/${groupId} HTTP ${res.status}`);
      return null;
    }

    const body = await res.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const row = body as WahaRemoteChat;
      const subject = typeof row.subject === 'string' ? row.subject : row.name;
      return {
        ...row,
        id: row.id ?? row.chatId ?? row.jid ?? groupId,
        name: subject,
        _wahaSource: 'group-detail',
      };
    }
  } catch (err) {
    logger.warn(`group detail failed ${groupId}: ${(err as Error).message}`);
  }

  return null;
}

/** POST /api/{session}/chats/overview with id filter — overview names update faster after phone renames. */
export async function fetchWahaChatsOverviewByIds(
  sessionName: string,
  ids: string[],
): Promise<WahaRemoteChat[]> {
  if (ids.length === 0) {
    return [];
  }

  const { baseUrl, apiKey } = getWahaConfig();
  const url = `${baseUrl}/api/${encodeURIComponent(sessionName)}/chats/overview`;
  const all: WahaRemoteChat[] = [];
  const chunkSize = 80;

  try {
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...wahaHeaders(apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pagination: { limit: chunk.length, offset: 0 },
          filter: { ids: chunk },
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        logger.warn(`chats/overview POST ${sessionName} HTTP ${res.status}`);
        break;
      }

      all.push(...normalizeChatRows(await res.json()));
    }
  } catch (err) {
    logger.warn(`chats/overview POST failed: ${(err as Error).message}`);
  }

  return all;
}

/** Paginated GET /api/{session}/groups — authoritative group subjects after renames. */
export async function fetchWahaGroups(sessionName: string): Promise<WahaRemoteChat[]> {
  const { baseUrl, apiKey } = getWahaConfig();
  const all: WahaRemoteChat[] = [];
  let offset = 0;

  try {
    for (let page = 0; page < 50; page += 1) {
      const url = `${baseUrl}/api/${encodeURIComponent(sessionName)}/groups?limit=${PAGE_SIZE}&offset=${offset}&exclude=participants`;
      const res = await fetch(url, {
        headers: wahaHeaders(apiKey),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        logger.warn(`groups ${sessionName} HTTP ${res.status} offset=${offset}`);
        break;
      }

      const rows = normalizeChatRows(await res.json());
      if (rows.length === 0) {
        break;
      }

      all.push(
        ...rows.map((row) => {
          const id = String(row.id ?? row.chatId ?? row.jid ?? '').trim();
          const subject = typeof row.subject === 'string' ? row.subject : row.name;
          return {
            ...row,
            id: id || row.id,
            name: subject,
            subject,
            _wahaSource: 'groups',
          };
        }),
      );

      if (rows.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }
  } catch (err) {
    logger.warn(`groups list failed: ${(err as Error).message}`);
  }

  return all;
}

/** Channels from GET /api/{session}/channels */
export async function fetchWahaChannels(sessionName: string): Promise<WahaRemoteChat[]> {
  const { baseUrl, apiKey } = getWahaConfig();
  const url = `${baseUrl}/api/${encodeURIComponent(sessionName)}/channels`;

  try {
    const res = await fetch(url, {
      headers: wahaHeaders(apiKey),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      logger.warn(`channels ${sessionName} HTTP ${res.status}`);
      return [];
    }

    const rows = normalizeChatRows(await res.json());
    return rows.map((row) => ({
      ...row,
      id: row.id ?? row.chatId ?? row.jid,
      _wahaSource: 'channels',
    }));
  } catch (err) {
    logger.warn(`channels failed: ${(err as Error).message}`);
    return [];
  }
}

/** Merge overview + full chats + channels (deduped by id). */
export async function fetchWahaChatList(sessionName: string): Promise<WahaRemoteChat[]> {
  const detailed = await fetchWahaChatListDetailed(sessionName);
  return detailed.chats;
}

export type WahaChatFetchSummary = {
  chats: WahaRemoteChat[];
  overviewCount: number;
  allChatsCount: number;
  groupsCount: number;
  channelsCount: number;
  mergedCount: number;
};

export async function fetchWahaChatListDetailed(sessionName: string): Promise<WahaChatFetchSummary> {
  const [overview, allChats, groups, channels] = await Promise.all([
    fetchWahaChatsOverview(sessionName),
    fetchWahaAllChats(sessionName),
    fetchWahaGroups(sessionName),
    fetchWahaChannels(sessionName),
  ]);

  const byId = new Map<string, WahaRemoteChat>();
  mergeChatRows(byId, allChats);
  mergeChatRows(byId, groups);
  mergeChatRows(byId, channels);
  mergeChatRows(byId, overview);

  const groupIds = [...byId.keys()].filter((id) => id.endsWith('@g.us'));
  if (groupIds.length > 0) {
    const overviewByIds = await fetchWahaChatsOverviewByIds(sessionName, groupIds);
    mergeChatRows(byId, overviewByIds);
  }

  logger.log(
    `chat list ${sessionName}: overview=${overview.length} all=${allChats.length} groups=${groups.length} channels=${channels.length} merged=${byId.size}`,
  );

  return {
    chats: [...byId.values()],
    overviewCount: overview.length,
    allChatsCount: allChats.length,
    groupsCount: groups.length,
    channelsCount: channels.length,
    mergedCount: byId.size,
  };
}
