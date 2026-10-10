'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { Check, RefreshCw, X } from 'lucide-react';

interface ReviewItem {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  reviewNotes?: string | null;
  payload?: {
    body?: string | null;
    reviewReason?: string;
    destinationChatIds?: string[];
    mediaUrl?: string | null;
    originalMediaUrl?: string | null;
    type?: string;
  };
  message?: {
    body?: string | null;
    sender?: string;
    chatId?: string;
    type?: string;
  } | null;
  rule?: {
    name?: string;
    reviewMode?: string;
  } | null;
}

export default function ReviewsPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      const path = filter === 'pending' ? '/reviews?status=pending' : '/reviews';
      const data = await fetchApi<ReviewItem[]>(path);
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
    const interval = setInterval(loadReviews, 15000);
    return () => clearInterval(interval);
  }, [filter]);

  const handleApprove = async (id: string) => {
    setActingId(id);
    try {
      await fetchApi(`/reviews/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewNotes: notes[id]?.trim() || undefined }),
      });
      await loadReviews();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActingId(id);
    try {
      await fetchApi(`/reviews/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reviewNotes: notes[id]?.trim() || undefined }),
      });
      await loadReviews();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Review Queue</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Approve or reject messages held by pipeline review rules before they are forwarded
          </p>
        </div>
        <button type="button" onClick={loadReviews} className="btn-secondary">
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(['pending', 'all'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={filter === value ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setFilter(value)}
          >
            {value === 'pending' ? 'Pending' : 'All'}
          </button>
        ))}
      </div>

      <div className="card">
        {isLoading && items.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No review items{filter === 'pending' ? ' pending' : ''}.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.rule?.name || 'Rule'}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {item.payload?.reviewReason || 'Awaiting review'}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {item.status}
                  </span>
                </div>

                <div
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem',
                    marginBottom: '0.75rem',
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.875rem',
                  }}
                >
                  {item.payload?.body || item.message?.body || '(no text)'}
                </div>

                {(item.payload?.originalMediaUrl || item.payload?.mediaUrl) &&
                (item.payload?.type === 'image' || item.message?.type === 'image') ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: item.payload?.originalMediaUrl ? '1fr 1fr' : '1fr',
                      gap: '0.75rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    {item.payload?.originalMediaUrl ? (
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Original
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.payload.originalMediaUrl}
                          alt="Original"
                          style={{ maxWidth: '100%', borderRadius: 'var(--radius-sm)' }}
                        />
                      </div>
                    ) : null}
                    {item.payload?.mediaUrl ? (
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          {item.payload?.originalMediaUrl ? 'Edited preview' : 'Image'}
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.payload.mediaUrl}
                          alt="Preview"
                          style={{ maxWidth: '100%', borderRadius: 'var(--radius-sm)' }}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  From {item.message?.sender || 'unknown'} · Expires {new Date(item.expiresAt).toLocaleString()}
                </div>

                {item.status === 'pending' ? (
                  <>
                    <textarea
                      value={notes[item.id] || ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Optional review notes"
                      rows={2}
                      style={{
                        width: '100%',
                        marginBottom: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'inherit',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={actingId === item.id}
                        onClick={() => handleApprove(item.id)}
                      >
                        <Check size={16} /> Approve & forward
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={actingId === item.id}
                        onClick={() => handleReject(item.id)}
                      >
                        <X size={16} /> Reject
                      </button>
                    </div>
                  </>
                ) : item.reviewNotes ? (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Notes: {item.reviewNotes}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
