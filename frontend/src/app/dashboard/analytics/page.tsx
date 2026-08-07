'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { fetchApi } from '@/lib/api';
import { RefreshCw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface AnalyticsData {
  window: string;
  interval: string;
  forwards: Array<{ label: string; sent: number; failed: number; pending: number; capDeferred: number }>;
  reviews: Array<{ label: string; pending: number; approved: number; rejected: number; autoForwarded: number }>;
  pipeline: Array<{ label: string; forward: number; skip: number; review: number }>;
  inbound: Array<{ label: string; count: number }>;
  byRule: Array<{ ruleName: string; sent: number; failed: number; pending: number; total: number }>;
  byDestination: Array<{ destinationChatId: string; sent: number; failed: number; pending: number; total: number }>;
}

const CHART_COLORS = {
  sent: '#22c55e',
  failed: '#ef4444',
  pending: '#f59e0b',
  capDeferred: '#a855f7',
  forward: '#6366f1',
  skip: '#64748b',
  review: '#06b6d4',
  approved: '#22c55e',
  rejected: '#ef4444',
  autoForwarded: '#8b5cf6',
  inbound: '#38bdf8',
};

export default function AnalyticsPage() {
  const [window, setWindow] = useState('24h');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const result = await fetchApi<AnalyticsData>(`/metrics/analytics?window=${encodeURIComponent(window)}`);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    const interval = setInterval(loadAnalytics, 60000);
    return () => clearInterval(interval);
  }, [window]);

  const totalSent = data?.forwards.reduce((sum, row) => sum + row.sent, 0) ?? 0;
  const totalCapDeferred = data?.forwards.reduce((sum, row) => sum + row.capDeferred, 0) ?? 0;
  const totalInbound = data?.inbound.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const totalReviewQueued = data?.pipeline.reduce((sum, row) => sum + row.review, 0) ?? 0;

  return (
    <div className="animate-fade-in">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Analytics</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Trend charts for forwards, pipeline outcomes, reviews, and inbound volume
            {data ? ` · bucket ${data.interval}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            className="input-field"
            value={window}
            onChange={(e) => setWindow(e.target.value)}
            style={{ width: '140px' }}
          >
            <option value="1h">Last 1 hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>
          <button type="button" onClick={loadAnalytics} className="btn-secondary">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading analytics...</div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem',
            }}
          >
            <SummaryCard label="Sent" value={totalSent} />
            <SummaryCard label="Cap queued" value={totalCapDeferred} />
            <SummaryCard label="Inbound messages" value={totalInbound} />
            <SummaryCard label="Pipeline reviews" value={totalReviewQueued} />
          </div>

          <ChartCard title="Outbound forwards" subtitle="Sent, failed, pending, and cap-deferred sends over time">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data?.forwards ?? []}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} />
                <Legend />
                <Line type="monotone" dataKey="sent" stroke={CHART_COLORS.sent} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="failed" stroke={CHART_COLORS.failed} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pending" stroke={CHART_COLORS.pending} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="capDeferred" name="cap deferred" stroke={CHART_COLORS.capDeferred} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
            <ChartCard title="Pipeline outcomes" subtitle="Forward, skip, and review decisions">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.pipeline ?? []}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} />
                  <Legend />
                  <Bar dataKey="forward" fill={CHART_COLORS.forward} />
                  <Bar dataKey="skip" fill={CHART_COLORS.skip} />
                  <Bar dataKey="review" fill={CHART_COLORS.review} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Review queue activity" subtitle="Items created per bucket by final/disposition status">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.reviews ?? []}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} />
                  <Legend />
                  <Bar dataKey="approved" fill={CHART_COLORS.approved} />
                  <Bar dataKey="rejected" fill={CHART_COLORS.rejected} />
                  <Bar dataKey="pending" fill={CHART_COLORS.pending} />
                  <Bar dataKey="autoForwarded" name="auto forwarded" fill={CHART_COLORS.autoForwarded} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Inbound message volume" subtitle="Messages received on connected WhatsApp sessions">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data?.inbound ?? []}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} />
                <Line type="monotone" dataKey="count" name="inbound" stroke={CHART_COLORS.inbound} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
            <ChartCard title="Top rules by forward volume" subtitle="Up to 10 rules in the selected window">
              <ResponsiveContainer width="100%" height={Math.max(220, (data?.byRule.length ?? 0) * 36)}>
                <BarChart data={data?.byRule ?? []} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis type="category" dataKey="ruleName" width={120} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} />
                  <Legend />
                  <Bar dataKey="sent" stackId="a" fill={CHART_COLORS.sent} />
                  <Bar dataKey="pending" stackId="a" fill={CHART_COLORS.pending} />
                  <Bar dataKey="failed" stackId="a" fill={CHART_COLORS.failed} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top destinations" subtitle="Up to 10 destination chats/groups">
              <ResponsiveContainer width="100%" height={Math.max(220, (data?.byDestination.length ?? 0) * 36)}>
                <BarChart
                  data={(data?.byDestination ?? []).map((row) => ({
                    ...row,
                    label: row.destinationChatId.length > 28
                      ? `${row.destinationChatId.slice(0, 28)}…`
                      : row.destinationChatId,
                  }))}
                  layout="vertical"
                  margin={{ left: 20 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={140} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.destinationChatId ?? ''}
                  />
                  <Legend />
                  <Bar dataKey="sent" stackId="a" fill={CHART_COLORS.sent} />
                  <Bar dataKey="pending" stackId="a" fill={CHART_COLORS.pending} />
                  <Bar dataKey="failed" stackId="a" fill={CHART_COLORS.failed} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 600, marginTop: '0.35rem' }}>{value}</div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{title}</h3>
      {subtitle ? (
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{subtitle}</p>
      ) : (
        <div style={{ marginBottom: '1rem' }} />
      )}
      {children}
    </div>
  );
}
