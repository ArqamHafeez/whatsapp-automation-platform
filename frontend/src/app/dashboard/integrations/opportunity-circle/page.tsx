'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { formatChatDisplayLabel } from '@/lib/chat-display';
import { Copy, Eye, KeyRound, RefreshCw, Save, Shield } from 'lucide-react';

type PreviewItem = {
  messageId: string;
  sentAt: string;
  category: string | null;
  sourceChatTitle: string | null;
  destinationChatTitle: string | null;
  ruleName: string | null;
  bodyPreview: string;
};

const OC_CATEGORIES = [
  { value: '', label: '(use default only)' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'internships', label: 'Internships' },
  { value: 'scholarships', label: 'Scholarships' },
  { value: 'admissions', label: 'Admissions' },
  { value: 'events', label: 'Events' },
];

interface Integration {
  id: string;
  enabled: boolean;
  connectionId: string;
  connectionName: string | null;
  sinkChatIds: string[];
  primarySinkChatId: string | null;
  categoryByRuleId: Record<string, string>;
  defaultCategory: string | null;
  hasApiKey: boolean;
  updatedAt?: string;
}

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
  isDestination?: boolean;
}

interface Rule {
  id: string;
  name: string;
  connectionId: string;
  isActive: boolean;
}

export default function OpportunityCircleIntegrationPage() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [connectionId, setConnectionId] = useState('');
  const [sinkChatIds, setSinkChatIds] = useState<string[]>([]);
  const [primarySinkChatId, setPrimarySinkChatId] = useState<string | null>(null);
  const [defaultCategory, setDefaultCategory] = useState('');
  const [categoryByRuleId, setCategoryByRuleId] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const applyIntegration = (row: Integration) => {
    setIntegration(row);
    setEnabled(row.enabled);
    setConnectionId(row.connectionId || '');
    setSinkChatIds(row.sinkChatIds || []);
    setPrimarySinkChatId(row.primarySinkChatId);
    setDefaultCategory(row.defaultCategory || '');
    setCategoryByRuleId(
      row.categoryByRuleId && typeof row.categoryByRuleId === 'object'
        ? { ...row.categoryByRuleId }
        : {},
    );
  };

  const loadChats = useCallback(async (connId: string) => {
    if (!connId) {
      setChats([]);
      return;
    }
    try {
      const data = await fetchApi<Chat[]>(`/chats?connectionId=${connId}`);
      const sorted = [...data].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      setChats(sorted);
    } catch (err) {
      console.error(err);
      setChats([]);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [intRes, connRes, rulesRes] = await Promise.all([
        fetchApi<{ ok: boolean; integration: Integration }>('/admin/integrations/opportunity-circle'),
        fetchApi<Connection[]>('/connections'),
        fetchApi<Rule[]>('/rules'),
      ]);
      setConnections(connRes);
      setRules(rulesRes.filter((r) => r.isActive));
      applyIntegration(intRes.integration);
      await loadChats(intRes.integration.connectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integration');
    } finally {
      setIsLoading(false);
    }
  }, [loadChats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (connectionId) {
      loadChats(connectionId);
    }
  }, [connectionId, loadChats]);

  const toggleSink = (chatId: string) => {
    setSinkChatIds((prev) => {
      if (prev.includes(chatId)) {
        const next = prev.filter((id) => id !== chatId);
        if (primarySinkChatId === chatId) {
          setPrimarySinkChatId(next[0] ?? null);
        }
        return next;
      }
      const next = [...prev, chatId];
      if (!primarySinkChatId) {
        setPrimarySinkChatId(chatId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetchApi<{ ok: boolean; integration: Integration }>(
        '/admin/integrations/opportunity-circle',
        {
          method: 'PATCH',
          body: JSON.stringify({
            enabled,
            connectionId,
            sinkChatIds,
            primarySinkChatId,
            defaultCategory: defaultCategory || null,
            categoryByRuleId,
          }),
        },
      );
      applyIntegration(res.integration);
      setMessage('Settings saved. Opportunity Circle can pull forwards to the selected sink chats.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRotateKey = async () => {
    if (!window.confirm('Generate a new API key? The old key stops working immediately.')) {
      return;
    }
    setIsRotating(true);
    setRevealedKey(null);
    setError(null);
    try {
      const res = await fetchApi<{ ok: boolean; apiKey: string; message: string }>(
        '/admin/integrations/opportunity-circle/rotate-key',
        { method: 'POST' },
      );
      setRevealedKey(res.apiKey);
      setMessage(res.message);
      setIntegration((prev) => (prev ? { ...prev, hasApiKey: true } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rotate key');
    } finally {
      setIsRotating(false);
    }
  };

  const copyKey = async () => {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setMessage('API key copied to clipboard.');
  };

  const loadPreview = async () => {
    setIsPreviewLoading(true);
    setError(null);
    try {
      const res = await fetchApi<{ ok: boolean; preview: { count: number; items: PreviewItem[] } }>(
        '/admin/integrations/opportunity-circle/preview?limit=5',
      );
      setPreviewItems(res.preview?.items || []);
      if (!res.preview?.items?.length) {
        setMessage('No successful forwards to sink destinations yet.');
      } else {
        setMessage(`Showing ${res.preview.count} recent forward(s) eligible for Opportunity Circle.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
      setPreviewItems([]);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const connectionRules = rules.filter((r) => r.connectionId === connectionId);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Loading Opportunity Circle integration…</div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>Opportunity Circle</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', lineHeight: 1.55 }}>
          When a forward <strong>successfully reaches</strong> a sink destination (e.g. your Opportunity Circle channel),
          Opportunity Circle can ingest it as a staged listing. No per-rule toggle — routing is destination-based.
        </p>
      </div>

      {error ? (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#fca5a5',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(34, 197, 94, 0.12)',
            color: '#86efac',
            fontSize: '0.875rem',
          }}
        >
          {message}
        </div>
      ) : null}

      <section
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={18} /> Connection & API key
        </h2>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enable integration (allow Opportunity Circle to call the forwards API)
        </label>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            WhatsApp connection
          </label>
          <select
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '0.6rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-page)',
              color: 'var(--text-primary)',
            }}
          >
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.status})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleRotateKey}
            disabled={isRotating}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-page)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <KeyRound size={16} />
            {integration?.hasApiKey ? 'Rotate API key' : 'Generate API key'}
          </button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {integration?.hasApiKey ? 'A key is configured.' : 'No key yet — generate one for Opportunity Circle.'}
          </span>
        </div>

        {revealedKey ? (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
            }}
          >
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Copy once — not shown again
            </div>
            <code style={{ wordBreak: 'break-all', fontSize: '0.85rem' }}>{revealedKey}</code>
            <button
              type="button"
              onClick={copyKey}
              style={{
                marginTop: '0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--primary)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              <Copy size={14} /> Copy key
            </button>
            <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Paste into Opportunity Circle → Admin → Ingestion → WhatsApp settings. Use your Nest public URL (port 3000), not the Next.js UI.
            </p>
          </div>
        ) : null}
      </section>

      <section
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Sink destinations</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Select chats that count as Opportunity Circle feeds (usually your Opportunity Circle channel). Only successful
          sends to these destinations are exposed to the API.
        </p>

        {chats.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No chats for this connection. Sync chats under Chats &amp; Groups first.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '280px', overflowY: 'auto' }}>
            {chats.map((chat) => {
              const checked = sinkChatIds.includes(chat.id);
              const isPrimary = primarySinkChatId === chat.id;
              return (
                <label
                  key={chat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.5rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    background: checked ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleSink(chat.id)} />
                  <span style={{ flex: 1 }}>
                    {formatChatDisplayLabel(chat)}
                    <span style={{ color: 'var(--text-muted)', marginLeft: '0.35rem' }}>({chat.type})</span>
                  </span>
                  {checked ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setPrimarySinkChatId(chat.id);
                      }}
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.2rem 0.45rem',
                        borderRadius: '4px',
                        border: isPrimary ? '1px solid var(--primary)' : '1px solid var(--border)',
                        background: isPrimary ? 'var(--primary)' : 'transparent',
                        color: isPrimary ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {isPrimary ? 'Primary' : 'Set primary'}
                    </button>
                  ) : null}
                </label>
              );
            })}
          </div>
        )}
      </section>

      <section
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Categories for Opportunity Circle</h2>
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Default category (when a rule has no mapping)
          </label>
          <select
            value={defaultCategory}
            onChange={(e) => setDefaultCategory(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '280px',
              padding: '0.6rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-page)',
              color: 'var(--text-primary)',
            }}
          >
            {OC_CATEGORIES.map((c) => (
              <option key={c.value || 'none'} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {connectionRules.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {connectionRules.map((rule) => (
              <div key={rule.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ minWidth: '200px', fontSize: '0.875rem' }}>{rule.name}</span>
                <select
                  value={categoryByRuleId[rule.id] || ''}
                  onChange={(e) =>
                    setCategoryByRuleId((prev) => ({
                      ...prev,
                      [rule.id]: e.target.value,
                    }))
                  }
                  style={{
                    padding: '0.45rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-page)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  {OC_CATEGORIES.map((c) => (
                    <option key={c.value || 'inherit'} value={c.value}>
                      {c.value ? c.label : 'Inherit default'}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No active rules on this connection.</p>
        )}
      </section>

      <section
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Preview recent forwards</h2>
          <button
            type="button"
            onClick={loadPreview}
            disabled={isPreviewLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-page)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            <Eye size={15} />
            {isPreviewLoading ? 'Loading…' : 'Load preview'}
          </button>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Same data Opportunity Circle would ingest (last successful sends to your sink chats). Save sink selection first.
        </p>
        {previewItems.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {previewItems.map((row) => (
              <div
                key={row.messageId}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-page)',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  <span>{row.sentAt ? new Date(row.sentAt).toLocaleString() : '—'}</span>
                  {row.category ? <span>· {row.category}</span> : null}
                  {row.sourceChatTitle ? <span>· from {row.sourceChatTitle}</span> : null}
                  {row.destinationChatTitle ? <span>· → {row.destinationChatTitle}</span> : null}
                </div>
                <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{row.bodyPreview}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Click load preview after configuring sinks.</p>
        )}
      </section>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--primary)',
            color: '#fff',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Save size={16} />
          {isSaving ? 'Saving…' : 'Save settings'}
        </button>
        <button
          type="button"
          onClick={() => loadAll()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={16} /> Reload
        </button>
      </div>
    </div>
  );
}
