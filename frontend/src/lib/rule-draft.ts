export const RULE_FORM_DRAFT_KEY = 'whatsapp-platform:rule-form-draft';

export type RuleFormDraft = {
  isEditing: string;
  formData: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
    reviewMode?: string;
    reviewTimeoutMinutes?: number;
    connectionId?: string;
    sourceChatIds?: string[];
    destinationChatIds?: string[];
    pipelineAgentIds?: string[];
  };
};

export function readRuleFormDraft(): RuleFormDraft | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(RULE_FORM_DRAFT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as RuleFormDraft;
    if (!parsed?.isEditing || !parsed.formData) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeRuleFormDraft(draft: RuleFormDraft | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (!draft) {
    sessionStorage.removeItem(RULE_FORM_DRAFT_KEY);
    return;
  }
  sessionStorage.setItem(RULE_FORM_DRAFT_KEY, JSON.stringify(draft));
}

export function hasRuleFormDraft(): boolean {
  return readRuleFormDraft() !== null;
}
