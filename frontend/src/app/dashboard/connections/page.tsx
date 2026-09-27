'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ConnectionQrImage } from '@/components/ConnectionQrImage';
import { Plus, RefreshCw, Trash2, CheckCircle2, XCircle, Clock, Smartphone } from 'lucide-react';

interface Connection {
  id: string;
  name: string;
  status: string;
  hasQr?: boolean;
  externalId?: string;
  wahaStatus?: string | null;
}

export default function ConnectionsPage() {
  const { token, isLoading: authLoading } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qrRefreshById, setQrRefreshById] = useState<Record<string, number>>({});

  const loadConnections = async () => {
    try {
      setLoadError(null);
      const data = await fetchApi<Connection[]>('/connections');
      setConnections(data);
    } catch (err) {
      console.error('Failed to load connections', err);
      const message = err instanceof Error ? err.message : 'Failed to load connections';
      setLoadError(
        `${message}. Open the app at http://localhost:3001 (frontend), keep Nest on port 3000, and restart Next after config changes.`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!token) {
      setIsLoading(false);
      return;
    }
    loadConnections();
    const interval = setInterval(loadConnections, 5000);
    return () => clearInterval(interval);
  }, [authLoading, token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await fetchApi<Connection>('/connections', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName('');
      setConnections((prev) => {
        const withoutDup = prev.filter((c) => c.id !== created.id);
        return [created, ...withoutDup];
      });
      await loadConnections();
      setQrRefreshById((prev) => ({ ...prev, [created.id]: Date.now() }));
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to create connection';
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRefreshQr = async (id: string) => {
    try {
      setCreateError(null);
      const updated = await fetchApi<Connection>(`/connections/${id}/refresh-qr`, { method: 'POST' });
      setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
      setQrRefreshById((prev) => ({ ...prev, [id]: Date.now() }));
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to refresh QR';
      setCreateError(message);
    }
  };

  const handleRegisterWebhook = async (id: string) => {
    try {
      setCreateError(null);
      const result = await fetchApi<{ ok: boolean; webhookUrl: string }>(`/connections/${id}/register-webhook`, {
        method: 'POST',
      });
      alert(`Webhook registered:\n${result.webhookUrl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register webhook';
      setCreateError(message);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this number?')) return;
    try {
      await fetchApi(`/connections/${id}/disconnect`, { method: 'POST' });
      await loadConnections();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>WhatsApp Connections</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your linked WhatsApp numbers</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem', background: 'rgba(99, 102, 241, 0.05)', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Smartphone size={18} color="var(--primary)" /> Add New Connection
        </h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {createError ? (
            <div style={{ width: '100%', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
              {createError}
            </div>
          ) : null}
          <input
            type="text"
            className="input-field"
            placeholder="Connection Name (e.g. Sales Team Line)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={isCreating}
            style={{ maxWidth: '400px', background: 'var(--bg-base)' }}
          />
          <button type="submit" className="btn-primary" disabled={isCreating || !newName.trim()}>
            <Plus size={18} /> Connect Number
          </button>
        </form>
      </div>

      {loadError ? (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            borderColor: 'rgba(244, 63, 94, 0.3)',
            color: 'var(--accent)',
            fontSize: '0.875rem',
          }}
        >
          {loadError}
        </div>
      ) : null}

      {isLoading && connections.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw className="animate-spin" style={{ margin: '0 auto 1rem', display: 'block', animation: 'spin 1s linear infinite' }} />
          Loading connections...
        </div>
      ) : connections.length === 0 ? (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <Smartphone size={48} color="var(--border)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No connections yet</h3>
          <p style={{ color: 'var(--text-muted)' }}>Add your first WhatsApp number to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {connections.map((conn) => (
            <div key={conn.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{conn.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {conn.status === 'connected' && <><CheckCircle2 size={14} color="var(--secondary)" /> Connected</>}
                    {conn.status === 'pending' && <><Clock size={14} color="var(--accent)" /> Pending Auth</>}
                    {conn.status === 'disconnected' && <><XCircle size={14} color="var(--text-muted)" /> Disconnected</>}
                  </div>
                  {conn.externalId ? (
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      WAHA session: {conn.externalId}
                      {conn.wahaStatus ? ` · ${conn.wahaStatus}` : ''}
                    </p>
                  ) : null}
                </div>
              </div>

              {conn.status === 'pending' && (
                <div style={{ background: '#fff', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', textAlign: 'center', minHeight: '120px' }}>
                  <ConnectionQrImage
                    connectionId={conn.id}
                    enabled={conn.status === 'pending'}
                    refreshToken={qrRefreshById[conn.id] ?? 0}
                    onAlreadyLinked={() => void loadConnections()}
                  />
                  <p style={{ color: '#000', fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 500 }}>
                    Scan with WhatsApp → Linked devices. Already scanned? Click Check status / QR or wait a few seconds.
                  </p>
                </div>
              )}

              <div style={{ marginTop: 'auto', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {conn.status === 'connected' && (
                  <button
                    onClick={() => void handleRegisterWebhook(conn.id)}
                    className="btn-secondary"
                    style={{ flex: 1, minWidth: '140px' }}
                  >
                    Register webhook
                  </button>
                )}
                {conn.status === 'pending' && (
                  <button onClick={() => handleRefreshQr(conn.id)} className="btn-secondary" style={{ flex: 1 }}>
                    <RefreshCw size={16} /> Check status / QR
                  </button>
                )}
                {conn.status !== 'disconnected' && (
                  <button onClick={() => handleDisconnect(conn.id)} className="btn-secondary" style={{ flex: 1, color: 'var(--accent)', borderColor: 'rgba(244, 63, 94, 0.3)' }}>
                    <Trash2 size={16} /> Disconnect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
