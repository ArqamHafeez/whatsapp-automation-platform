'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '@/lib/api';
import { formatChatDisplayLabel, chatMatchesSearch } from '@/lib/chat-display';
import { useRuleDraft } from '@/context/RuleDraftContext';
import { Plus, RefreshCw, Trash2, Edit2, Play, Pause, Save, X, Search, FlaskConical, ChevronUp, ChevronDown } from 'lucide-react';
import {
  describePipelineOrder,
  formatPipelineTypeLabel,
  getPipelineWarnings,
  movePipelineAgentId,
} from '@/lib/pipeline-order';

interface Rule {
  id: string;
  connectionId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  reviewMode: string;
  reviewTimeoutMinutes: number;
  sourceChatIds: string[];
  destinationChatIds: string[];
  pipelineAgentIds: string[];
}

interface PipelineAgent {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

const cloneRule = (rule: Rule): Rule => ({
  ...rule,
  sourceChatIds: [...rule.sourceChatIds],
  destinationChatIds: [...rule.destinationChatIds],
  pipelineAgentIds: [...(rule.pipelineAgentIds || [])],
});

interface Chat {
  id: string;
  title: string;
  type: string;
  connectionId: string;
  externalChatId?: string;
}

interface Connection {
  id: string;
  name: string;
  status: string;
}

export default function RulesPage() {
  const {
    isEditing,
    formData,
    setFormData,
    startNewRule,
    editRule: openEditRule,
    cancelEditing,
    clearDraftAfterSave,
  } = useRuleDraft();

  const [rules, setRules] = useState<Rule[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [connectionChats, setConnectionChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingChats, setIsRefreshingChats] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [chatPickerSearch, setChatPickerSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [connectionLoadError, setConnectionLoadError] = useState<string | null>(null);
  const [chatLoadError, setChatLoadError] = useState<string | null>(null);
  const [pipelineAgents, setPipelineAgents] = useState<PipelineAgent[]>([]);
  const [simulateRuleId, setSimulateRuleId] = useState<string | null>(null);
  const [simulateBody, setSimulateBody] = useState('Test job posting: remote software engineer role');
  const [simulateResult, setSimulateResult] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const loadChatsForConnection = useCallback(async (connectionId: string) => {
    if (!connectionId) {
      setConnectionChats([]);
      return;
    }
    setIsRefreshingChats(true);
    setChatLoadError(null);
    try {
      const data = await fetchApi<Chat[]>(`/chats?connectionId=${connectionId}`);
      const sorted = [...data].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      setConnectionChats(sorted);
    } catch (err) {
      console.error(err);
      setConnectionChats([]);
      setChatLoadError(err instanceof Error ? err.message : 'Failed to load chats');
    } finally {
      setIsRefreshingChats(false);
    }
  }, []);

  const setupFormConnectionPicker = useCallback(
    async (rule?: Rule, draftConnectionId?: string) => {
      setConnectionLoadError(null);
      try {
        const data = await fetchApi<Connection[]>('/connections');
        const active = data.filter((c) => c.status === 'connected');
        setConnections(active);

        let connectionId = rule?.connectionId ?? '';
        if (!connectionId && draftConnectionId && active.some((a) => a.id === draftConnectionId)) {
          connectionId = draftConnectionId;
        }
        if (!connectionId) {
          connectionId = active[0]?.id ?? '';
        }

        if (rule && !connectionId) {
          const ids = [...rule.sourceChatIds, ...rule.destinationChatIds];
          if (ids.length > 0) {
            const lookup = await fetchApi<Chat[]>('/chats');
            const match = lookup.find((c) => ids.includes(c.id));
            if (match?.connectionId && active.some((a) => a.id === match.connectionId)) {
              connectionId = match.connectionId;
            }
          }
        }

        setSelectedConnectionId(connectionId);
        setFormData((prev) => ({ ...prev, connectionId }));
        if (!connectionId) {
          setConnectionChats([]);
        }

        if (active.length === 0) {
          setConnectionLoadError('No connected WhatsApp instance found. Connect a number under Connections first.');
        }
      } catch (err) {
        console.error(err);
        setConnections([]);
        setConnectionLoadError(err instanceof Error ? err.message : 'Failed to load connections');
      }
    },
    [setFormData],
  );

  const syncChatsFromDevice = async () => {
    if (!selectedConnectionId) {
      setSyncMessage('Select a WhatsApp connection first.');
      return;
    }
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const result = await fetchApi<{ syncedCount: number }>(`/chats/sync/${selectedConnectionId}`, {
        method: 'POST',
      });
      await loadChatsForConnection(selectedConnectionId);
      setSyncMessage(`Synced ${result.syncedCount} chat(s) from WhatsApp. Pick sources and destinations below.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setSyncMessage(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rulesData, agentsData] = await Promise.all([
        fetchApi<Rule[]>('/rules'),
        fetchApi<PipelineAgent[]>('/agents'),
      ]);
      setRules(rulesData.map(cloneRule));
      setPipelineAgents(agentsData.filter((a) => a.isActive));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isEditing || isLoading) {
      return;
    }
    const rule = isEditing === 'new' ? undefined : rules.find((r) => r.id === isEditing);
    void setupFormConnectionPicker(rule, formData.connectionId || undefined);
    // Only re-run when entering edit mode or rules list finishes loading — not on every form keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, isLoading, rules]);

  useEffect(() => {
    if (!isEditing || !selectedConnectionId) {
      return;
    }
    void loadChatsForConnection(selectedConnectionId);
  }, [selectedConnectionId, isEditing, loadChatsForConnection]);

  const toggleRuleSource = (chatId: string) => {
    setFormData((prev) => {
      const sources = prev.sourceChatIds || [];
      const destinations = prev.destinationChatIds || [];
      if (sources.includes(chatId)) {
        return { ...prev, sourceChatIds: sources.filter((id) => id !== chatId) };
      }
      return {
        ...prev,
        sourceChatIds: [...sources, chatId],
        destinationChatIds: destinations.filter((id) => id !== chatId),
      };
    });
  };

  const toggleRuleDestination = (chatId: string) => {
    setFormData((prev) => {
      const sources = prev.sourceChatIds || [];
      const destinations = prev.destinationChatIds || [];
      if (destinations.includes(chatId)) {
        return { ...prev, destinationChatIds: destinations.filter((id) => id !== chatId) };
      }
      return {
        ...prev,
        destinationChatIds: [...destinations, chatId],
        sourceChatIds: sources.filter((id) => id !== chatId),
      };
    });
  };

  const filteredPickerChats = connectionChats.filter((c) => chatMatchesSearch(c, chatPickerSearch));

  const addPipelineAgent = (agentId: string) => {
    setFormData((prev) => {
      const ids = prev.pipelineAgentIds || [];
      if (ids.includes(agentId)) return prev;
      return {
        ...prev,
        pipelineAgentIds: [...ids, agentId],
      };
    });
  };

  const movePipelineAgent = (index: number, direction: 'up' | 'down') => {
    setFormData((prev) => ({
      ...prev,
      pipelineAgentIds: movePipelineAgentId(prev.pipelineAgentIds || [], index, direction),
    }));
  };

  const pipelineWarnings = getPipelineWarnings(formData.pipelineAgentIds || [], pipelineAgents);

  const removePipelineAgent = (agentId: string) => {
    setFormData((prev) => ({
      ...prev,
      pipelineAgentIds: (prev.pipelineAgentIds || []).filter((id) => id !== agentId),
    }));
  };

  const runSimulate = async (ruleId: string) => {
    setIsSimulating(true);
    setSimulateResult(null);
    try {
      const result = await fetchApi<{
        pipelineAction: string;
        pipelineMode?: string;
        messageId?: string;
        decisionId?: string;
        reason?: string;
        deliveriesQueued: number;
        reviewItemId?: string;
      }>(`/rules/${ruleId}/simulate`, {
        method: 'POST',
        body: JSON.stringify({ body: simulateBody }),
      });
      const parts = [
        `Pipeline: ${result.pipelineAction}`,
        result.pipelineMode ? `Mode: ${result.pipelineMode}` : null,
        result.reason ? `Reason: ${result.reason}` : null,
        result.pipelineAction === 'forward' ? `Deliveries queued: ${result.deliveriesQueued}` : null,
        result.pipelineAction === 'review' ? 'Check Review Queue' : null,
        result.messageId ? 'See Delivery Log → Audit for step details' : null,
      ].filter(Boolean);
      setSimulateResult(parts.join(' · '));
    } catch (err) {
      setSimulateResult(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  const selectedOnThisConnection = {
    sources: connectionChats.filter((c) => (formData.sourceChatIds || []).includes(c.id)).length,
    destinations: connectionChats.filter((c) => (formData.destinationChatIds || []).includes(c.id)).length,
  };

  const buildRulePayload = (connectionId: string, data: typeof formData & { name: string }) => ({
    connectionId,
    name: data.name.trim(),
    description: data.description?.trim() || null,
    isActive: data.isActive ?? true,
    reviewMode: data.reviewMode || 'off',
    reviewTimeoutMinutes: data.reviewTimeoutMinutes ?? 1440,
    sourceChatIds: data.sourceChatIds || [],
    destinationChatIds: data.destinationChatIds || [],
    pipelineAgentIds: data.pipelineAgentIds || [],
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    const name = formData.name?.trim();
    if (!name) {
      setSaveError('Rule name is required.');
      return;
    }

    if (!selectedConnectionId) {
      setSaveError('Select a WhatsApp connection for this rule.');
      return;
    }

    const sources = formData.sourceChatIds || [];
    const destinations = formData.destinationChatIds || [];
    if (sources.length === 0) {
      setSaveError('Select at least one source chat.');
      return;
    }
    if (destinations.length === 0) {
      setSaveError('Select at least one destination chat.');
      return;
    }
    if (sources.some((id) => destinations.includes(id))) {
      setSaveError('A chat cannot be both a source and a destination on the same rule.');
      return;
    }

    const payload = buildRulePayload(selectedConnectionId, {
      ...formData,
      name,
      sourceChatIds: [...sources],
      destinationChatIds: [...destinations],
    });

    try {
      if (isEditing === 'new') {
        await fetchApi('/rules', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else if (isEditing) {
        await fetchApi(`/rules/${isEditing}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      clearDraftAfterSave();
      await loadData();
    } catch (err) {
      console.error(err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save rule');
    }
  };

  const toggleActive = async (rule: Rule) => {
    try {
      await fetchApi(`/rules/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      setRules(rules.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r)));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await fetchApi(`/rules/${id}`, { method: 'DELETE' });
      setRules(rules.filter((r) => r.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const editRule = (rule: Rule) => {
    setSaveError(null);
    setChatPickerSearch('');
    openEditRule(cloneRule(rule));
  };

  const beginNewRule = () => {
    setSaveError(null);
    setChatPickerSearch('');
    startNewRule();
  };

  const handleCancelEdit = () => {
    setSelectedConnectionId('');
    setConnectionChats([]);
    setConnections([]);
    setConnectionLoadError(null);
    setChatLoadError(null);
    setSyncMessage(null);
    cancelEditing();
    void loadData();
  };

  if (isLoading && !isEditing) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem', display: 'block', animation: 'spin 1s linear infinite' }} />
        Loading Rules...
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="animate-fade-in card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2>{isEditing === 'new' ? 'Create New Rule' : 'Edit Rule'}</h2>
          <button onClick={handleCancelEdit} className="btn-secondary" style={{ padding: '0.5rem' }} type="button">
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            marginBottom: '1.5rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}
        >
          Choose your WhatsApp connection, click <strong style={{ color: 'var(--text-primary)' }}>Sync from WhatsApp</strong>, then
          check sources and destinations for this rule only. Save Rule writes to the database.
        </div>

        {syncMessage ? (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              background: syncMessage.startsWith('Synced')
                ? 'rgba(16, 185, 129, 0.08)'
                : 'rgba(244, 63, 94, 0.08)',
              border: `1px solid ${syncMessage.startsWith('Synced') ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
              color: 'var(--text-secondary)',
            }}
          >
            {syncMessage}
          </div>
        ) : null}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {saveError ? (
            <div
              style={{
                background: 'rgba(244, 63, 94, 0.1)',
                color: 'var(--accent)',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                border: '1px solid rgba(244, 63, 94, 0.2)',
              }}
            >
              {saveError}
            </div>
          ) : null}
          <div>
            <label className="label">Rule Name</label>
            <input
              type="text"
              className="input-field"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Description (Optional)</label>
            <textarea
              className="input-field"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="card" style={{ background: 'var(--bg-base)', padding: '1rem' }}>
            <label className="label">WhatsApp connection (instance)</label>
            <select
              className="input-field"
              value={selectedConnectionId}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedConnectionId(next);
                setFormData((prev) => ({
                  ...prev,
                  connectionId: next,
                  sourceChatIds: [],
                  destinationChatIds: [],
                }));
              }}
            >
              <option value="">-- Choose a connection --</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {!selectedConnectionId ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Select an instance to load its chats and groups for this rule.
              </p>
            ) : null}
            {connectionLoadError ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--accent)', marginTop: '0.5rem' }}>{connectionLoadError}</p>
            ) : null}
          </div>

          <div style={{ position: 'relative', maxWidth: '360px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="search"
              className="input-field"
              placeholder="Search synced chats…"
              value={chatPickerSearch}
              onChange={(e) => setChatPickerSearch(e.target.value)}
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              On this connection: {selectedOnThisConnection.sources} source(s), {selectedOnThisConnection.destinations}{' '}
              destination(s) · Rule total: {(formData.sourceChatIds || []).length} source(s),{' '}
              {(formData.destinationChatIds || []).length} destination(s)
            </span>
            <button
              type="button"
              className="btn-primary"
              disabled={isSyncing || !selectedConnectionId}
              onClick={() => void syncChatsFromDevice()}
            >
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? ' Syncing…' : ' Sync from WhatsApp'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={isRefreshingChats || !selectedConnectionId}
              onClick={() => void loadChatsForConnection(selectedConnectionId)}
            >
              <RefreshCw size={16} className={isRefreshingChats ? 'animate-spin' : ''} />
              {isRefreshingChats ? ' Refreshing…' : ' Refresh chat lists'}
            </button>
          </div>

          {chatLoadError ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--accent)', margin: '-0.5rem 0 0' }}>{chatLoadError}</p>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div className="card" style={{ background: 'var(--bg-base)' }}>
              <label className="label" style={{ marginBottom: '1rem', color: 'var(--primary)' }}>
                Source Chats (for this rule)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
                {connectionChats.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {!selectedConnectionId
                      ? 'Select a connection above.'
                      : 'No chats loaded yet.'}{' '}
                    Use <strong>Sync from WhatsApp</strong> above (same as Chats &amp; Groups sync).
                  </p>
                ) : null}
                {filteredPickerChats.map((chat) => {
                  const checked = (formData.sourceChatIds || []).includes(chat.id);
                  const onDest = (formData.destinationChatIds || []).includes(chat.id);
                  return (
                    <label
                      key={`src-${chat.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: onDest ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        opacity: onDest ? 0.45 : 1,
                      }}
                      title={onDest ? 'Remove from destinations first' : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={onDest}
                        onChange={() => toggleRuleSource(chat.id)}
                      />
                      <span>{formatChatDisplayLabel(chat)}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {chat.type}
                      </span>
                      {chat.externalChatId ? (
                        <span
                          style={{
                            fontSize: '0.6rem',
                            color: 'var(--text-muted)',
                            fontFamily: 'monospace',
                            marginLeft: 'auto',
                            maxWidth: '140px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={chat.externalChatId}
                        >
                          {chat.externalChatId}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="card" style={{ background: 'var(--bg-base)' }}>
              <label className="label" style={{ marginBottom: '1rem', color: 'var(--secondary)' }}>
                Destination Chats (for this rule)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
                {connectionChats.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {!selectedConnectionId
                      ? 'Select a connection above.'
                      : 'No chats loaded yet.'}{' '}
                    Use <strong>Sync from WhatsApp</strong> above (same as Chats &amp; Groups sync).
                  </p>
                ) : null}
                {filteredPickerChats.map((chat) => {
                  const checked = (formData.destinationChatIds || []).includes(chat.id);
                  const onSource = (formData.sourceChatIds || []).includes(chat.id);
                  return (
                    <label
                      key={`dst-${chat.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: onSource ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        opacity: onSource ? 0.45 : 1,
                      }}
                      title={onSource ? 'Remove from sources first' : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={onSource}
                        onChange={() => toggleRuleDestination(chat.id)}
                      />
                      <span>{formatChatDisplayLabel(chat)}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {chat.type}
                      </span>
                      {chat.externalChatId ? (
                        <span
                          style={{
                            fontSize: '0.6rem',
                            color: 'var(--text-muted)',
                            fontFamily: 'monospace',
                            marginLeft: 'auto',
                            maxWidth: '140px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={chat.externalChatId}
                        >
                          {chat.externalChatId}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '1.5rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div>
              <label className="label">AI Pipeline (optional)</label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Agents run top to bottom in the order you set. Leave empty to forward directly after matching.
              </p>
              {pipelineWarnings.length > 0 ? (
                <div
                  style={{
                    marginBottom: '0.75rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(234, 179, 8, 0.35)',
                    background: 'rgba(234, 179, 8, 0.08)',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {pipelineWarnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              ) : null}
              {(formData.pipelineAgentIds || []).length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No agents in pipeline (passthrough)</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {(formData.pipelineAgentIds || []).map((agentId, index) => {
                    const agent = pipelineAgents.find((a) => a.id === agentId);
                    const ids = formData.pipelineAgentIds || [];
                    return (
                      <div
                        key={agentId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 0.75rem',
                          background: 'var(--bg-base)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '1.5rem' }}>
                          {index + 1}.
                        </span>
                        <span style={{ flex: 1, fontSize: '0.875rem' }}>
                          {agent?.name || agentId}{' '}
                          <span style={{ color: 'var(--text-muted)' }}>
                            ({formatPipelineTypeLabel(agent?.type || 'unknown')})
                          </span>
                        </span>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.25rem' }}
                            disabled={index === 0}
                            onClick={() => movePipelineAgent(index, 'up')}
                            title="Move up"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.25rem' }}
                            disabled={index === ids.length - 1}
                            onClick={() => movePipelineAgent(index, 'down')}
                            title="Move down"
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.25rem', color: 'var(--accent)' }}
                            onClick={() => removePipelineAgent(agentId)}
                            title="Remove"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {pipelineAgents.filter((a) => !(formData.pipelineAgentIds || []).includes(a.id)).length > 0 ? (
              <div>
                <label className="label">Add agent</label>
                <select
                  className="input-field"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addPipelineAgent(e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">Select agent to add…</option>
                  {pipelineAgents
                    .filter((a) => !(formData.pipelineAgentIds || []).includes(a.id))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Create agents under <strong>AI Agents</strong> in the sidebar first.
              </p>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '2rem',
              padding: '1.5rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ flex: 1 }}>
              <label className="label">Review Mode</label>
              <select
                className="input-field"
                value={formData.reviewMode || 'off'}
                onChange={(e) => setFormData({ ...formData, reviewMode: e.target.value })}
              >
                <option value="off">Off (Direct Forward)</option>
                <option value="on_escalation">On Escalation (AI Flags)</option>
                <option value="always">Always Review</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Review Timeout (Minutes)</label>
              <input
                type="number"
                className="input-field"
                value={formData.reviewTimeoutMinutes || 1440}
                onChange={(e) =>
                  setFormData({ ...formData, reviewTimeoutMinutes: parseInt(e.target.value, 10) || 1440 })
                }
              />
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '-0.5rem 0 0' }}>
            Review mode controls whether matched messages are held for human approval before forwarding.
            <strong> On escalation</strong> holds messages when an agent sets <code>needsReview</code>, routing is
            low-confidence, or an image watermark is detected. Pipeline errors always fail-open (forward). Use{' '}
            <strong>always</strong> to hold every forward.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" onClick={handleCancelEdit} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Save size={18} /> Save Rule
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Forwarding Rules</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Configure automated message routing</p>
        </div>
        <button onClick={beginNewRule} className="btn-primary">
          <Plus size={18} /> Create Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>No rules configured</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Create your first routing rule to start forwarding messages.</p>
          <button onClick={beginNewRule} className="btn-primary">
            <Plus size={18} /> Create Rule
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {rules.map((rule) => (
            <div key={rule.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {rule.name}
                    {!rule.isActive && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.1rem 0.4rem',
                          background: 'var(--border)',
                          borderRadius: '4px',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        PAUSED
                      </span>
                    )}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', minHeight: '1.5rem' }}>{rule.description}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Review: {rule.reviewMode.replace('_', ' ')} · Pipeline:{' '}
                    {describePipelineOrder(rule.pipelineAgentIds || [], pipelineAgents) ||
                      `${rule.pipelineAgentIds?.length || 0} agent(s)`}
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  margin: '1rem 0',
                  padding: '1rem',
                  background: 'var(--bg-base)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Sources
                  </div>
                  <div style={{ fontWeight: 500 }}>{rule.sourceChatIds.length} Chats</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Destinations
                  </div>
                  <div style={{ fontWeight: 500 }}>{rule.destinationChatIds.length} Chats</div>
                </div>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                {simulateRuleId === rule.id ? (
                  <div style={{ padding: '0.75rem', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)' }}>
                    <textarea
                      className="input-field"
                      rows={2}
                      value={simulateBody}
                      onChange={(e) => setSimulateBody(e.target.value)}
                      placeholder="Simulated message body…"
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ flex: 1, fontSize: '0.8125rem' }}
                        disabled={isSimulating}
                        onClick={() => runSimulate(rule.id)}
                      >
                        <FlaskConical size={14} /> Run test
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setSimulateRuleId(null)}>
                        Close
                      </button>
                    </div>
                    {simulateResult && simulateRuleId === rule.id ? (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{simulateResult}</p>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: '100%', fontSize: '0.8125rem' }}
                    onClick={() => {
                      setSimulateRuleId(rule.id);
                      setSimulateResult(null);
                    }}
                  >
                    <FlaskConical size={14} /> Test rule (simulate message)
                  </button>
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => toggleActive(rule)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem', color: rule.isActive ? 'var(--text-primary)' : 'var(--secondary)' }}
                >
                  {rule.isActive ? (
                    <>
                      <Pause size={14} /> Pause
                    </>
                  ) : (
                    <>
                      <Play size={14} /> Activate
                    </>
                  )}
                </button>
                <button onClick={() => editRule(rule)} className="btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}>
                  <Edit2 size={14} /> Edit
                </button>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="btn-secondary"
                  style={{ padding: '0.5rem', color: 'var(--accent)', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                >
                  <Trash2 size={14} />
                </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
