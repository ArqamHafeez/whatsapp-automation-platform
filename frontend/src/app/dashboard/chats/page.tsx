'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { formatChatDisplayLabel, chatMatchesSearch } from '@/lib/chat-display';
import { RefreshCw, Users, Search, Save, X } from 'lucide-react';

interface Connection {
  id: string;
  name: string;
  status: string;
}

interface Chat {
  id: string;
  title: string;
  type: string;
  externalChatId?: string;
  description?: string | null;
  maxSendsPerHour?: number | null;
  maxSendsPerDay?: number | null;
}

type CapDraft = {
  maxSendsPerHour: string;
  maxSendsPerDay: string;
};

function formatCap(value: number | null | undefined): string {
  if (value == null) return '—';
  return String(value);
}

function parseCapInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('Caps must be whole numbers of 1 or greater, or empty to clear');
  }
  return n;
}

export default function ChatsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDescriptionId, setSavingDescriptionId] = useState<string | null>(null);
  const [editingCapsId, setEditingCapsId] = useState<string | null>(null);
  const [capsDraft, setCapsDraft] = useState<CapDraft>({ maxSendsPerHour: '', maxSendsPerDay: '' });
  const [savingCapsId, setSavingCapsId] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    if (selectedConnection) {
      loadChats(selectedConnection);
    } else {
      setChats([]);
    }
  }, [selectedConnection]);

  const loadConnections = async () => {
    try {
      const data = await fetchApi<Connection[]>('/connections');
      const active = data.filter((c: Connection) => c.status === 'connected');
      setConnections(active);
      if (active.length > 0 && !selectedConnection) {
        setSelectedConnection(active[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadChats = async (connectionId: string) => {
    setIsLoading(true);
    try {
      const data = await fetchApi<Chat[]>(`/chats?connectionId=${connectionId}`);
      setChats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedConnection) return;
    setIsSyncing(true);
    try {
      const result = await fetchApi<{ syncedCount: number; hint?: string; wahaSources?: Record<string, number> }>(
        `/chats/sync/${selectedConnection}`,
        { method: 'POST' },
      );
      await loadChats(selectedConnection);
      const sources = result.wahaSources
        ? `\nWAHA: ${result.wahaSources.merged ?? result.syncedCount} chats (overview ${result.wahaSources.overview ?? 0}, all ${result.wahaSources.allChats ?? 0}, channels ${result.wahaSources.channels ?? 0})`
        : '';
      alert(`Synced ${result.syncedCount} chats.${sources}${result.hint ? `\n\n${result.hint}` : ''}`);
    } catch (err) {
      console.error(err);
      alert('Failed to sync chats');
    } finally {
      setIsSyncing(false);
    }
  };

  const beginEditDescription = (chat: Chat) => {
    setEditingDescriptionId(chat.id);
    setDescriptionDraft(chat.description || '');
    setEditingCapsId(null);
  };

  const cancelEditDescription = () => {
    setEditingDescriptionId(null);
    setDescriptionDraft('');
  };

  const saveDescription = async (chatId: string) => {
    setSavingDescriptionId(chatId);
    try {
      await fetchApi(`/chats/${chatId}`, {
        method: 'PATCH',
        body: JSON.stringify({ description: descriptionDraft.trim() || null }),
      });
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId ? { ...chat, description: descriptionDraft.trim() || null } : chat,
        ),
      );
      cancelEditDescription();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save description');
    } finally {
      setSavingDescriptionId(null);
    }
  };

  const beginEditCaps = (chat: Chat) => {
    setEditingCapsId(chat.id);
    setCapsDraft({
      maxSendsPerHour: chat.maxSendsPerHour != null ? String(chat.maxSendsPerHour) : '',
      maxSendsPerDay: chat.maxSendsPerDay != null ? String(chat.maxSendsPerDay) : '',
    });
    setEditingDescriptionId(null);
  };

  const cancelEditCaps = () => {
    setEditingCapsId(null);
    setCapsDraft({ maxSendsPerHour: '', maxSendsPerDay: '' });
  };

  const saveCaps = async (chatId: string) => {
    setSavingCapsId(chatId);
    try {
      const maxSendsPerHour = parseCapInput(capsDraft.maxSendsPerHour);
      const maxSendsPerDay = parseCapInput(capsDraft.maxSendsPerDay);
      await fetchApi(`/chats/${chatId}`, {
        method: 'PATCH',
        body: JSON.stringify({ maxSendsPerHour, maxSendsPerDay }),
      });
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId ? { ...chat, maxSendsPerHour, maxSendsPerDay } : chat,
        ),
      );
      cancelEditCaps();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save send caps');
    } finally {
      setSavingCapsId(null);
    }
  };

  const filteredChats = chats.filter((c) => chatMatchesSearch(c, search));

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Chats & Groups</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Sync and browse chats for each WhatsApp connection. Add destination descriptions to help route agents.
            Set optional send caps per destination group. Choose sources and destinations per rule on{' '}
            <Link href="/dashboard/rules" style={{ color: 'var(--primary)' }}>
              Forwarding Rules
            </Link>
            .
          </p>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        Destination descriptions are passed to route agents (e.g. &quot;Remote engineering roles only&quot;). Source
        descriptions give relevance agents extra context. Send caps limit how many messages can be forwarded to a
        destination per hour or day — excess sends stay queued and retry automatically when the window opens.
      </div>

      <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <label className="label">Select WhatsApp Connection</label>
          <select
            className="input-field"
            value={selectedConnection}
            onChange={(e) => setSelectedConnection(e.target.value)}
          >
            <option value="">-- Choose a connection --</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ alignSelf: 'flex-end' }}>
          <button onClick={handleSync} className="btn-secondary" disabled={!selectedConnection || isSyncing}>
            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
            Sync from Device
          </button>
        </div>
      </div>

      {selectedConnection && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem' }}>Available Chats</h3>
            <div style={{ position: 'relative', width: '300px' }}>
              <Search
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                size={16}
              />
              <input
                type="text"
                className="input-field"
                placeholder="Search chats..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '2.5rem', background: 'var(--bg-base)' }}
              />
            </div>
          </div>

          {isLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw className="animate-spin" style={{ margin: '0 auto 1rem', display: 'block', animation: 'spin 1s linear infinite' }} />
              Loading chats...
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '1rem', fontWeight: 500 }}>Chat Name</th>
                    <th style={{ padding: '1rem', fontWeight: 500 }}>Type</th>
                    <th style={{ padding: '1rem', fontWeight: 500, minWidth: '280px' }}>Description (for AI routing)</th>
                    <th style={{ padding: '1rem', fontWeight: 500, minWidth: '180px' }}>Send caps</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChats.map((chat) => (
                    <tr key={chat.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: 'rgba(255,255,255,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Users size={16} color="var(--text-muted)" />
                          </div>
                          <span style={{ fontWeight: 500 }}>{formatChatDisplayLabel(chat)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {chat.type}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {editingDescriptionId === chat.id ? (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                            <textarea
                              className="input-field"
                              rows={2}
                              value={descriptionDraft}
                              onChange={(e) => setDescriptionDraft(e.target.value)}
                              placeholder="What belongs in this chat?"
                              style={{ flex: 1, fontSize: '0.8125rem' }}
                            />
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ padding: '0.35rem' }}
                              disabled={savingDescriptionId === chat.id}
                              onClick={() => saveDescription(chat.id)}
                            >
                              <Save size={14} />
                            </button>
                            <button type="button" className="btn-secondary" style={{ padding: '0.35rem' }} onClick={cancelEditDescription}>
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => beginEditDescription(chat)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              textAlign: 'left',
                              color: chat.description ? 'var(--text-secondary)' : 'var(--text-muted)',
                              fontSize: '0.8125rem',
                              cursor: 'pointer',
                              width: '100%',
                            }}
                          >
                            {chat.description || 'Add description…'}
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {editingCapsId === chat.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '2.5rem' }}>Hr</label>
                              <input
                                type="number"
                                min={1}
                                className="input-field"
                                value={capsDraft.maxSendsPerHour}
                                onChange={(e) => setCapsDraft((d) => ({ ...d, maxSendsPerHour: e.target.value }))}
                                placeholder="∞"
                                style={{ width: '5rem', fontSize: '0.8125rem' }}
                              />
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '2rem' }}>Day</label>
                              <input
                                type="number"
                                min={1}
                                className="input-field"
                                value={capsDraft.maxSendsPerDay}
                                onChange={(e) => setCapsDraft((d) => ({ ...d, maxSendsPerDay: e.target.value }))}
                                placeholder="∞"
                                style={{ width: '5rem', fontSize: '0.8125rem' }}
                              />
                              <button
                                type="button"
                                className="btn-primary"
                                style={{ padding: '0.35rem' }}
                                disabled={savingCapsId === chat.id}
                                onClick={() => saveCaps(chat.id)}
                              >
                                <Save size={14} />
                              </button>
                              <button type="button" className="btn-secondary" style={{ padding: '0.35rem' }} onClick={cancelEditCaps}>
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => beginEditCaps(chat)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              textAlign: 'left',
                              color:
                                chat.maxSendsPerHour != null || chat.maxSendsPerDay != null
                                  ? 'var(--text-secondary)'
                                  : 'var(--text-muted)',
                              fontSize: '0.8125rem',
                              cursor: 'pointer',
                              width: '100%',
                            }}
                          >
                            {chat.maxSendsPerHour != null || chat.maxSendsPerDay != null ? (
                              <>
                                {formatCap(chat.maxSendsPerHour)}/hr · {formatCap(chat.maxSendsPerDay)}/day
                              </>
                            ) : (
                              'Set caps…'
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredChats.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No chats found. Try syncing from device.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
