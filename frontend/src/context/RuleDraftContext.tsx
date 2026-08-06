'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  readRuleFormDraft,
  writeRuleFormDraft,
  type RuleFormDraft,
} from '@/lib/rule-draft';

export type RuleFormData = RuleFormDraft['formData'];

export const cloneRuleFormData = (data: RuleFormData): RuleFormData => ({
  ...data,
  sourceChatIds: [...(data.sourceChatIds ?? [])],
  destinationChatIds: [...(data.destinationChatIds ?? [])],
  pipelineAgentIds: [...(data.pipelineAgentIds ?? [])],
});

export const emptyRuleForm = (): RuleFormData => ({
  name: '',
  description: '',
  isActive: true,
  reviewMode: 'off',
  reviewTimeoutMinutes: 1440,
  connectionId: '',
  sourceChatIds: [],
  destinationChatIds: [],
  pipelineAgentIds: [],
});

type RuleDraftContextValue = {
  isEditing: string | null;
  formData: RuleFormData;
  isDraftActive: boolean;
  setFormData: React.Dispatch<React.SetStateAction<RuleFormData>>;
  startNewRule: () => void;
  editRule: (rule: RuleFormData & { id: string; connectionId?: string; pipelineAgentIds?: string[] }) => void;
  cancelEditing: () => void;
  clearDraftAfterSave: () => void;
};

const RuleDraftContext = createContext<RuleDraftContextValue | null>(null);

export function RuleDraftProvider({ children }: { children: React.ReactNode }) {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(emptyRuleForm);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const draft = readRuleFormDraft();
    if (draft) {
      setIsEditing(draft.isEditing);
      setFormData(cloneRuleFormData({ ...emptyRuleForm(), ...draft.formData }));
    }
    setStorageReady(true);
  }, []);

  const persistDraft = useCallback((editing: string | null, data: RuleFormData) => {
    if (!editing) {
      writeRuleFormDraft(null);
      return;
    }
    writeRuleFormDraft({ isEditing: editing, formData: cloneRuleFormData(data) });
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }
    persistDraft(isEditing, formData);
  }, [isEditing, formData, storageReady, persistDraft]);

  const startNewRule = useCallback(() => {
    const next = emptyRuleForm();
    setFormData(next);
    setIsEditing('new');
    writeRuleFormDraft({ isEditing: 'new', formData: cloneRuleFormData(next) });
  }, []);

  const editRule = useCallback((rule: RuleFormData & { id: string; connectionId?: string }) => {
    const next: RuleFormData = cloneRuleFormData({
      name: rule.name,
      description: rule.description,
      isActive: rule.isActive,
      reviewMode: rule.reviewMode,
      reviewTimeoutMinutes: rule.reviewTimeoutMinutes,
      connectionId: rule.connectionId ?? '',
      sourceChatIds: rule.sourceChatIds ?? [],
      destinationChatIds: rule.destinationChatIds ?? [],
      pipelineAgentIds: rule.pipelineAgentIds ?? [],
    });
    setFormData(next);
    setIsEditing(rule.id);
    writeRuleFormDraft({ isEditing: rule.id, formData: next });
  }, []);

  const cancelEditing = useCallback(() => {
    setIsEditing(null);
    setFormData(emptyRuleForm());
    writeRuleFormDraft(null);
  }, []);

  const clearDraftAfterSave = useCallback(() => {
    setIsEditing(null);
    setFormData(emptyRuleForm());
    writeRuleFormDraft(null);
  }, []);

  const value = useMemo(
    () => ({
      isEditing,
      formData,
      isDraftActive: isEditing !== null,
      setFormData,
      startNewRule,
      editRule,
      cancelEditing,
      clearDraftAfterSave,
    }),
    [isEditing, formData, startNewRule, editRule, cancelEditing, clearDraftAfterSave],
  );

  return <RuleDraftContext.Provider value={value}>{children}</RuleDraftContext.Provider>;

}

export function useRuleDraft(): RuleDraftContextValue {
  const ctx = useContext(RuleDraftContext);
  if (!ctx) {
    throw new Error('useRuleDraft must be used within RuleDraftProvider');
  }
  return ctx;
}
