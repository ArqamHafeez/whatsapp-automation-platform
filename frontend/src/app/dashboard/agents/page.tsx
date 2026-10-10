'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import {
  type AgentType,
  type StructuredConfigByType,
  STRUCTURED_FIELDS,
  STRUCTURED_POLICY_INTRO,
  emptyStructuredConfigForType,
  readStructuredConfigFromAgent,
  serializeStructuredConfig,
} from '@/lib/agent-structured-config';
import { Plus, RefreshCw, Trash2, Edit2, Save, X, Bot } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  description: string | null;
  type: AgentType;
  systemPrompt: string | null;
  userPromptTemplate: string | null;
  structuredConfig: Record<string, string> | null;
  model: string | null;
  isActive: boolean;
}

type AgentForm = {
  name: string;
  description: string;
  type: AgentType;
  systemPrompt: string;
  userPromptTemplate: string;
  structuredConfig: StructuredConfigByType[AgentType];
  showAdvanced: boolean;
  model: string;
  isActive: boolean;
};

const emptyForm = (): AgentForm => ({
  name: '',
  description: '',
  type: 'relevance',
  systemPrompt: '',
  userPromptTemplate: '',
  structuredConfig: emptyStructuredConfigForType('relevance'),
  showAdvanced: false,
  model: '',
  isActive: true,
});

const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  relevance: 'Relevance filter',
  clean: 'Text cleaner',
  route: 'Destination router',
  image_edit: 'Image watermark remover',
};

function StructuredPolicyFields({
  type,
  config,
  onChange,
}: {
  type: AgentType;
  config: StructuredConfigByType[AgentType];
  onChange: (next: StructuredConfigByType[AgentType]) => void;
}) {
  const fields = STRUCTURED_FIELDS[type];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {fields.map((field) => (
        <div key={field.key}>
          <label className="label">{field.label}</label>
          <textarea
            className="input-field"
            rows={field.rows ?? 2}
            value={(config as Record<string, string>)[field.key] ?? ''}
            placeholder={field.placeholder}
            onChange={(e) =>
              onChange({
                ...config,
                [field.key]: e.target.value,
              } as StructuredConfigByType[AgentType])
            }
          />
        </div>
      ))}
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AgentForm>(emptyForm());
  const [error, setError] = useState<string | null>(null);

  const loadAgents = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<Agent[]>('/agents');
      setAgents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const beginNew = () => {
    setEditingId('new');
    setForm(emptyForm());
    setError(null);
  };

  const beginEdit = (agent: Agent) => {
    setEditingId(agent.id);
    setForm({
      name: agent.name,
      description: agent.description || '',
      type: agent.type,
      systemPrompt: agent.systemPrompt || '',
      userPromptTemplate: agent.userPromptTemplate || '',
      structuredConfig: readStructuredConfigFromAgent(agent.type, agent.structuredConfig),
      showAdvanced: Boolean(agent.systemPrompt || agent.userPromptTemplate),
      model: agent.model || '',
      isActive: agent.isActive,
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
  };

  const handleTypeChange = (type: AgentType) => {
    setForm((prev) => ({
      ...prev,
      type,
      structuredConfig: emptyStructuredConfigForType(type),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Agent name is required.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      type: form.type,
      structuredConfig: serializeStructuredConfig(form.type, form.structuredConfig),
      systemPrompt: form.showAdvanced && form.systemPrompt.trim() ? form.systemPrompt.trim() : undefined,
      userPromptTemplate:
        form.showAdvanced && form.userPromptTemplate.trim() ? form.userPromptTemplate.trim() : undefined,
      model: form.model.trim() || undefined,
      isActive: form.isActive,
    };

    try {
      if (editingId === 'new') {
        await fetchApi('/agents', { method: 'POST', body: JSON.stringify(payload) });
      } else if (editingId) {
        await fetchApi(`/agents/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      }
      cancelEdit();
      await loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agent');
    }
  };

  const deleteAgent = async (id: string) => {
    if (!confirm('Delete this agent? Rules using it in their pipeline will need updating.')) return;
    try {
      await fetchApi(`/agents/${id}`, { method: 'DELETE' });
      await loadAgents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (editingId) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
            {editingId === 'new' ? 'New AI Agent' : 'Edit AI Agent'}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Reusable pipeline steps attached to forwarding rules</p>
        </div>

        <div className="card">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error ? (
              <div style={{ color: 'var(--accent)', fontSize: '0.875rem' }}>{error}</div>
            ) : null}

            <div>
              <label className="label">Name</label>
              <input
                className="input-field"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Announcements relevance filter"
              />
            </div>

            <div>
              <label className="label">Type</label>
              <select
                className="input-field"
                value={form.type}
                onChange={(e) => handleTypeChange(e.target.value as AgentType)}
              >
                {(Object.keys(AGENT_TYPE_LABELS) as AgentType[]).map((t) => (
                  <option key={t} value={t}>
                    {AGENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Description</label>
              <input
                className="input-field"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short note for admins (not sent to the model)"
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>
                Structured policy — {AGENT_TYPE_LABELS[form.type]}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {STRUCTURED_POLICY_INTRO[form.type]}
              </p>

              <StructuredPolicyFields
                type={form.type}
                config={form.structuredConfig}
                onChange={(structuredConfig) => setForm({ ...form, structuredConfig })}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={form.showAdvanced}
                onChange={(e) => setForm({ ...form, showAdvanced: e.target.checked })}
              />
              Advanced: override system/user prompts
            </label>

            {form.showAdvanced ? (
              <>
                <div>
                  <label className="label">System prompt override</label>
                  <textarea
                    className="input-field"
                    rows={3}
                    value={form.systemPrompt}
                    onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">User prompt template override</label>
                  <textarea
                    className="input-field"
                    rows={3}
                    value={form.userPromptTemplate}
                    onChange={(e) => setForm({ ...form, userPromptTemplate: e.target.value })}
                    placeholder="Use {{body}}, {{ruleName}}, {{sender}} tokens"
                  />
                </div>
              </>
            ) : null}

            <div>
              <label className="label">Model override (optional)</label>
              <input
                className="input-field"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="Defaults to OPENAI_MODEL / OLLAMA_MODEL in backend .env"
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button type="button" className="btn-secondary" onClick={cancelEdit}>
                <X size={16} /> Cancel
              </button>
              <button type="submit" className="btn-primary">
                <Save size={16} /> Save Agent
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>AI Agents</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Create agents here, then attach and order them on forwarding rules.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn-secondary" onClick={loadAgents}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button type="button" className="btn-primary" onClick={beginNew}>
            <Plus size={18} /> New Agent
          </button>
        </div>
      </div>

      {isLoading && agents.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading…
        </div>
      ) : agents.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <Bot size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3>No agents yet</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Create relevance, image edit, clean, and route agents for your forwarding pipeline.
          </p>
          <button type="button" className="btn-primary" onClick={beginNew}>
            <Plus size={18} /> Create first agent
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {agents.map((agent) => (
            <div key={agent.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem' }}>{agent.name}</h3>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--primary)',
                    }}
                  >
                    {AGENT_TYPE_LABELS[agent.type] || agent.type}
                  </span>
                </div>
                {!agent.isActive ? (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>INACTIVE</span>
                ) : null}
              </div>
              {agent.description ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{agent.description}</p>
              ) : null}
              <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => beginEdit(agent)}>
                  <Edit2 size={14} /> Edit
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ color: 'var(--accent)' }}
                  onClick={() => deleteAgent(agent.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
