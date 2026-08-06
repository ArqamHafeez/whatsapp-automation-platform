'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { RefreshCw, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface PipelineStepLog {
  agentName?: string;
  agentType?: string;
  status?: string;
  note?: string;
  error?: string;
  output?: Record<string, unknown>;
}

interface PipelineDecision {
  id: string;
  decisionType: string;
  pipelineMode: string | null;
  reviewReason: string | null;
  errorDetails?: string | null;
  destinations: string[];
  body: string | null;
  rule?: { name?: string };
  stepLogs?: PipelineStepLog[];
}

function renderStepSummary(step: PipelineStepLog): string | null {
  const output = step.output;
  if (!output || typeof output !== 'object') {
    return step.note || step.error || null;
  }
  if (step.agentType === 'clean' && Array.isArray(output.changes) && output.changes.length > 0) {
    return `Cleaned: ${(output.changes as string[]).join('; ')}`;
  }
  if (step.agentType === 'route' && Array.isArray(output.destinationChatIds)) {
    return `Routed to ${output.destinationChatIds.length} destination(s): ${output.reason || ''}`.trim();
  }
  if (step.agentType === 'relevance' && typeof output.relevant === 'boolean') {
    return output.relevant
      ? `Relevant: ${output.reason || 'yes'}`
      : `Not relevant: ${output.reason || 'no'}`;
  }
  if (typeof output.reason === 'string') {
    return output.reason;
  }
  return step.note || null;
}

interface SendLog {
  id: string;
  status: string;
  attempts: number;
  destinationChatId: string;
  errorDetails?: string | null;
  sentAt?: string | null;
  createdAt: string;
  message?: { body?: string | null; type?: string; chatId?: string; sender?: string };
  rule?: { name?: string };
}

interface InboundMessage {
  id: string;
  chatId: string;
  sender: string;
  body: string | null;
  type: string;
  receivedAt: string;
  connectionName: string;
  forwardCount: number;
  pipelineDecisions?: PipelineDecision[];
  sendLogs: Array<{
    id: string;
    status: string;
    destinationChatId: string;
    rule?: { name?: string };
  }>;
}

export default function DeliveryPage() {
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [inbound, setInbound] = useState<InboundMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [pipelineDecisions, setPipelineDecisions] = useState<Record<string, PipelineDecision[]>>({});
  const [loadingDecisions, setLoadingDecisions] = useState<string | null>(null);
  const [decisionsError, setDecisionsError] = useState<Record<string, string>>({});

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const [forwardData, inboundData] = await Promise.all([
        fetchApi<SendLog[]>('/delivery/logs'),
        fetchApi<InboundMessage[]>('/delivery/inbound'),
      ]);
      setLogs(forwardData);
      setInbound(inboundData);
      const embedded: Record<string, PipelineDecision[]> = {};
      for (const msg of inboundData) {
        if (msg.pipelineDecisions?.length) {
          embedded[msg.id] = msg.pipelineDecisions;
        }
      }
      setPipelineDecisions(embedded);
      setDecisionsError({});
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 15000);
    return () => clearInterval(interval);
  }, []);

  const togglePipeline = async (messageId: string) => {
    if (expandedMessageId === messageId) {
      setExpandedMessageId(null);
      return;
    }
    setExpandedMessageId(messageId);
    if (pipelineDecisions[messageId]?.length) return;
    setLoadingDecisions(messageId);
    try {
      const data = await fetchApi<PipelineDecision[]>(`/pipeline/decisions/${messageId}`);
      setPipelineDecisions((prev) => ({ ...prev, [messageId]: data }));
      setDecisionsError((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
    } catch (err) {
      console.error(err);
      setDecisionsError((prev) => ({
        ...prev,
        [messageId]: err instanceof Error ? err.message : 'Failed to load pipeline audit',
      }));
    } finally {
      setLoadingDecisions(null);
    }
  };

  const handleRetry = async (sendLogId: string) => {
    setRetryingId(sendLogId);
    try {
      await fetchApi(`/delivery/retry/${sendLogId}`, { method: 'POST' });
      await loadLogs();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Delivery Log</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Forwards to destinations and inbound messages from active rule source chats
          </p>
        </div>
        <button type="button" onClick={loadLogs} className="btn-secondary">
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Inbound messages (rule sources)</h2>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Only messages from chats/channels configured as <strong>sources</strong> on an active rule
          are shown. Groups, DMs, and channels not in any rule are hidden.
        </p>
        {isLoading && inbound.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : inbound.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No messages from rule source chats yet. Create an active rule and wait for traffic on its source chats.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>When</th>
                  <th style={{ padding: '0.75rem' }}>Connection</th>
                  <th style={{ padding: '0.75rem' }}>Chat JID</th>
                  <th style={{ padding: '0.75rem' }}>Preview</th>
                  <th style={{ padding: '0.75rem' }}>Forwards</th>
                  <th style={{ padding: '0.75rem' }}>Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {inbound.map((msg) => (
                  <>
                    <tr key={msg.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {new Date(msg.receivedAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{msg.connectionName}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.7rem', fontFamily: 'monospace' }}>{msg.chatId}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', maxWidth: '200px' }}>
                        {(msg.body || `[${msg.type}]`).slice(0, 60)}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                        {msg.forwardCount === 0 ? (
                          <span style={{ color: 'var(--accent)' }}>0 — held/skipped/review</span>
                        ) : (
                          msg.sendLogs.map((s) => `${s.rule?.name || 'rule'}: ${s.status}`).join(', ')
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                          onClick={() => togglePipeline(msg.id)}
                        >
                          {expandedMessageId === msg.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Audit
                        </button>
                      </td>
                    </tr>
                    {expandedMessageId === msg.id ? (
                      <tr key={`${msg.id}-pipeline`}>
                        <td colSpan={6} style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)' }}>
                          {loadingDecisions === msg.id ? (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</span>
                          ) : decisionsError[msg.id] ? (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--accent)' }}>{decisionsError[msg.id]}</span>
                          ) : (pipelineDecisions[msg.id] || []).length === 0 ? (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No pipeline decisions.</span>
                          ) : (
                            (pipelineDecisions[msg.id] || []).map((d) => (
                              <div
                                key={d.id}
                                style={{
                                  fontSize: '0.8125rem',
                                  padding: '0.5rem',
                                  marginBottom: '0.35rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                <strong>{d.rule?.name || 'Rule'}</strong> — {d.decisionType}
                                {d.pipelineMode ? ` (${d.pipelineMode})` : ''}
                                {d.reviewReason ? `: ${d.reviewReason}` : ''}
                                {d.errorDetails ? (
                                  <span style={{ color: 'var(--accent)' }}> · Agent error: {d.errorDetails}</span>
                                ) : null}
                                {Array.isArray(d.stepLogs) && d.stepLogs.length > 0 ? (
                                  <ul
                                    style={{
                                      margin: '0.5rem 0 0',
                                      paddingLeft: '1.25rem',
                                      color: 'var(--text-secondary)',
                                    }}
                                  >
                                    {d.stepLogs.map((step, index) => {
                                      const summary = renderStepSummary(step);
                                      return (
                                        <li key={`${d.id}-step-${index}`} style={{ marginBottom: '0.25rem' }}>
                                          <strong>{step.agentName || step.agentType || 'agent'}</strong>
                                          {step.status ? ` (${step.status})` : ''}
                                          {summary ? `: ${summary}` : null}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : null}
                                {d.body && d.decisionType === 'forward' ? (
                                  <div
                                    style={{
                                      marginTop: '0.5rem',
                                      fontSize: '0.75rem',
                                      color: 'var(--text-muted)',
                                      whiteSpace: 'pre-wrap',
                                    }}
                                  >
                                    Forwarded text: {d.body.slice(0, 300)}
                                    {d.body.length > 300 ? '…' : ''}
                                  </div>
                                ) : null}
                              </div>
                            ))
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Outbound forwards</h2>
        {isLoading && logs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading delivery log...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No forward attempts yet. They appear after a rule matches an inbound message.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>Rule</th>
                  <th style={{ padding: '0.75rem' }}>Preview</th>
                  <th style={{ padding: '0.75rem' }}>Destination</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>Attempts</th>
                  <th style={{ padding: '0.75rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{log.rule?.name || '—'}</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', maxWidth: '240px' }}>
                      {(log.message?.body || `[${log.message?.type || 'message'}]`).slice(0, 80)}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.75rem', fontFamily: 'monospace' }}>{log.destinationChatId}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <StatusPill status={log.status} />
                      {log.errorDetails ? (
                        <div style={{ fontSize: '0.7rem', color: 'var(--accent)', marginTop: '0.25rem' }}>{log.errorDetails.slice(0, 120)}</div>
                      ) : null}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{log.attempts}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {(log.status === 'failed' || log.status === 'pending') && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                          disabled={retryingId === log.id}
                          onClick={() => handleRetry(log.id)}
                        >
                          <RotateCcw size={14} /> {retryingId === log.id ? 'Retrying...' : 'Retry'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === 'sent'
      ? 'var(--secondary)'
      : status === 'failed'
        ? 'var(--accent)'
        : status === 'forwarded_on_pipeline_error'
          ? 'var(--primary)'
          : 'var(--text-muted)';
  return (
    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color }}>
      {status}
    </span>
  );
}
