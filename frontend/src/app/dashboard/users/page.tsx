'use client';

import { useEffect, useState } from 'react';
import { RoleGate } from '@/components/RoleGate';
import { fetchApi } from '@/lib/api';
import { Plus, RefreshCw, Shield, UserCheck } from 'lucide-react';

type TeamUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'reviewer';
  createdAt: string;
};

export default function UsersPage() {
  return (
    <RoleGate roles={['admin']}>
      <UsersPageInner />
    </RoleGate>
  );
}

function UsersPageInner() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'reviewer'>('reviewer');
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchApi<TeamUser[]>('/users');
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      await fetchApi('/users', {
        method: 'POST',
        body: JSON.stringify({ email, name, password, role }),
      });
      setEmail('');
      setName('');
      setPassword('');
      setRole('reviewer');
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Team Users</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Invite admins and reviewers for your organization</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="button" className="btn-secondary" onClick={loadUsers}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button type="button" className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> Add user
          </button>
        </div>
      </div>

      {error ? (
        <div className="card" style={{ marginBottom: '1rem', color: 'var(--accent)', borderColor: 'rgba(244,63,94,0.3)' }}>
          {error}
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: '1.5rem', display: 'grid', gap: '1rem' }}>
          <h3 style={{ margin: 0 }}>New team member</h3>
          <div>
            <label className="label">Name</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input-field" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input-field" value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'reviewer')}>
              <option value="reviewer">Reviewer — review queue + read-only delivery</option>
              <option value="admin">Admin — full platform access</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? 'Creating...' : 'Create user'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="card">
        {isLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading users...</p>
        ) : !users.length ? (
          <p style={{ color: 'var(--text-muted)' }}>No users yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.75rem' }}>Name</th>
                <th style={{ padding: '0.75rem' }}>Email</th>
                <th style={{ padding: '0.75rem' }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem' }}>{user.name || '—'}</td>
                  <td style={{ padding: '0.75rem' }}>{user.email}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem' }}>
                      {user.role === 'admin' ? <Shield size={14} /> : <UserCheck size={14} />}
                      {user.role === 'admin' ? 'Admin' : 'Reviewer'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
