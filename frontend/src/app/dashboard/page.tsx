'use client';

import React, { useEffect, useState } from 'react';
<<<<<<< HEAD
import { useAuth } from '@/context/AuthContext';
=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
import { fetchApi } from '@/lib/api';
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, Smartphone } from 'lucide-react';
import Link from 'next/link';

interface Throughput {
  window: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  dropped: number;
  forwardedOnPipelineError: number;
  successRate: number;
}

interface ConnectionHealth {
  connections: Array<{ id: string; name: string; status: string; lastSeenAt?: string | null }>;
  failedSendCount: number;
}

interface ReviewSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  oldestPendingAgeMinutes: number | null;
}

export default function DashboardHomePage() {
<<<<<<< HEAD
  const { isAdmin } = useAuth();
=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
  const [window, setWindow] = useState('24h');
  const [throughput, setThroughput] = useState<Throughput | null>(null);
  const [health, setHealth] = useState<ConnectionHealth | null>(null);
  const [review, setReview] = useState<ReviewSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
<<<<<<< HEAD
      const reviewData = await fetchApi<ReviewSummary>('/metrics/review-summary');
      setReview(reviewData);

      if (isAdmin) {
        const [throughputData, healthData] = await Promise.all([
          fetchApi<Throughput>(`/metrics/throughput?window=${encodeURIComponent(window)}`),
          fetchApi<ConnectionHealth>('/metrics/connection-health'),
        ]);
        setThroughput(throughputData);
        setHealth(healthData);
      }
=======
      const [throughputData, healthData, reviewData] = await Promise.all([
        fetchApi<Throughput>(`/metrics/throughput?window=${encodeURIComponent(window)}`),
        fetchApi<ConnectionHealth>('/metrics/connection-health'),
        fetchApi<ReviewSummary>('/metrics/review-summary'),
      ]);
      setThroughput(throughputData);
      setHealth(healthData);
      setReview(reviewData);
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
<<<<<<< HEAD
  }, [window, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Reviewer Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Review queue summary — approve or reject held messages</p>
        </div>
        {isLoading && !review ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : (
          <div className="card" style={{ maxWidth: '520px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Review queue</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <MiniStat label="Pending" value={review?.pending ?? 0} />
              <MiniStat label="Approved" value={review?.approved ?? 0} />
              <MiniStat label="Rejected" value={review?.rejected ?? 0} />
              <MiniStat label="Oldest pending (min)" value={review?.oldestPendingAgeMinutes ?? '—'} />
            </div>
            <Link href="/dashboard/reviews" className="btn-primary" style={{ display: 'inline-flex', marginTop: '1.5rem', gap: '0.5rem' }}>
              Open Review Queue
            </Link>
          </div>
        )}
      </div>
    );
  }
=======
  }, [window]);
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Health Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Connection status, throughput, and review queue</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select className="input-field" value={window} onChange={(e) => setWindow(e.target.value)} style={{ width: '140px' }}>
            <option value="1h">Last 1 hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>
          <button type="button" onClick={loadMetrics} className="btn-secondary">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {isLoading && !throughput ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading metrics...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <StatCard label="Forwarded (sent)" value={throughput?.sent ?? 0} icon={<CheckCircle2 size={18} color="var(--secondary)" />} />
            <StatCard label="Pending delivery" value={throughput?.pending ?? 0} icon={<Clock size={18} color="var(--accent)" />} />
            <StatCard label="Failed sends" value={throughput?.failed ?? 0} icon={<AlertTriangle size={18} color="var(--accent)" />} />
            <StatCard label="Dropped (pipeline skip)" value={throughput?.dropped ?? 0} icon={<Activity size={18} color="var(--text-muted)" />} />
            <StatCard label="Pipeline error forwards" value={throughput?.forwardedOnPipelineError ?? 0} icon={<Activity size={18} color="var(--primary)" />} />
            <StatCard label="Success rate" value={`${throughput?.successRate ?? 0}%`} icon={<Activity size={18} color="var(--text-muted)" />} />
            <StatCard label="Exhausted retries" value={health?.failedSendCount ?? 0} icon={<AlertTriangle size={18} color="var(--accent)" />} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Smartphone size={18} /> WhatsApp connections
              </h3>
              {!health?.connections.length ? (
                <p style={{ color: 'var(--text-muted)' }}>
                  No connections yet. <Link href="/dashboard/connections">Add a connection</Link>.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {health.connections.map((conn) => (
                    <li key={conn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)' }}>
                      <span>{conn.name}</span>
                      <StatusBadge status={conn.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Review queue</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <MiniStat label="Pending" value={review?.pending ?? 0} />
                <MiniStat label="Approved" value={review?.approved ?? 0} />
                <MiniStat label="Rejected" value={review?.rejected ?? 0} />
<<<<<<< HEAD
                <MiniStat label="Oldest pending (min)" value={review?.oldestPendingAgeMinutes ?? '—'} />
=======
                <MiniStat
                  label="Oldest pending (min)"
                  value={review?.oldestPendingAgeMinutes ?? '—'}
                />
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Pending items can be approved or rejected in the Review Queue.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        {icon}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: '0.75rem', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'connected' ? 'var(--secondary)' : status === 'pending' ? 'var(--accent)' : 'var(--text-muted)';
  return (
    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
}
