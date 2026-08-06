export type AgentType = 'relevance' | 'clean' | 'route';

export type RelevanceStructuredConfig = {
  inclusionCriteria: string;
  exclusionCriteria: string;
  reviewWhen: string;
  exampleRelevant: string;
  exampleIrrelevant: string;
};

export type CleanStructuredConfig = {
  removeWhen: string;
  preserveWhen: string;
  outputStyle: string;
  leaveUnchangedWhen: string;
  exampleBefore: string;
  exampleAfter: string;
};

export type RouteStructuredConfig = {
  routingRules: string;
  sendToMultipleWhen: string;
  reviewWhen: string;
  exampleMessage: string;
  exampleDestination: string;
  fallbackBehavior: string;
};

export type StructuredConfigByType = {
  relevance: RelevanceStructuredConfig;
  clean: CleanStructuredConfig;
  route: RouteStructuredConfig;
};

export const emptyRelevanceStructuredConfig = (): RelevanceStructuredConfig => ({
  inclusionCriteria: '',
  exclusionCriteria: '',
  reviewWhen: '',
  exampleRelevant: '',
  exampleIrrelevant: '',
});

export const emptyCleanStructuredConfig = (): CleanStructuredConfig => ({
  removeWhen: '',
  preserveWhen: '',
  outputStyle: '',
  leaveUnchangedWhen: '',
  exampleBefore: '',
  exampleAfter: '',
});

export const emptyRouteStructuredConfig = (): RouteStructuredConfig => ({
  routingRules: '',
  sendToMultipleWhen: '',
  reviewWhen: '',
  exampleMessage: '',
  exampleDestination: '',
  fallbackBehavior: '',
});

export function emptyStructuredConfigForType(type: AgentType) {
  if (type === 'clean') return emptyCleanStructuredConfig();
  if (type === 'route') return emptyRouteStructuredConfig();
  return emptyRelevanceStructuredConfig();
}

export function readStructuredConfigFromAgent(
  type: AgentType,
  raw: Record<string, string> | null | undefined,
) {
  const sc = raw ?? {};
  const empty = emptyStructuredConfigForType(type);
  return Object.fromEntries(
    Object.keys(empty).map((key) => [key, sc[key] || '']),
  ) as StructuredConfigByType[typeof type];
}

export function serializeStructuredConfig(
  type: AgentType,
  config: StructuredConfigByType[AgentType],
): Record<string, string> | undefined {
  const entries = Object.entries(config).filter(([, value]) => value.trim());
  return entries.length ? Object.fromEntries(entries.map(([k, v]) => [k, v.trim()])) : undefined;
}

export type StructuredFieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  rows?: number;
};

export const STRUCTURED_FIELDS: Record<AgentType, StructuredFieldDef[]> = {
  relevance: [
    { key: 'inclusionCriteria', label: 'Forward when (inclusion)', rows: 2 },
    { key: 'exclusionCriteria', label: 'Drop/skip when (exclusion)', rows: 2 },
    {
      key: 'reviewWhen',
      label: 'Flag for review when',
      rows: 2,
      placeholder: 'e.g. missing apply link, borderline match, visible watermark on image',
    },
    { key: 'exampleRelevant', label: 'Example relevant message', rows: 2 },
    { key: 'exampleIrrelevant', label: 'Example irrelevant message', rows: 2 },
  ],
  clean: [
    {
      key: 'removeWhen',
      label: 'Remove / strip when',
      rows: 2,
      placeholder: 'e.g. "Forwarded from", channel signatures, promo footers',
    },
    {
      key: 'preserveWhen',
      label: 'Always preserve',
      rows: 2,
      placeholder: 'e.g. apply links, salary, location, contact details',
    },
    {
      key: 'outputStyle',
      label: 'Output style',
      rows: 2,
      placeholder: 'e.g. keep full text, one short paragraph, bullet summary',
    },
    {
      key: 'leaveUnchangedWhen',
      label: 'Leave unchanged when',
      rows: 2,
      placeholder: 'e.g. message is already clean, image-only with no caption',
    },
    { key: 'exampleBefore', label: 'Example before (raw)', rows: 2 },
    { key: 'exampleAfter', label: 'Example after (cleaned)', rows: 2 },
  ],
  route: [
    {
      key: 'routingRules',
      label: 'Routing rules',
      rows: 3,
      placeholder: 'How to pick destinations — complements each chat description',
    },
    {
      key: 'sendToMultipleWhen',
      label: 'Send to multiple destinations when',
      rows: 2,
      placeholder: 'e.g. hybrid remote/on-site role fits both groups',
    },
    {
      key: 'reviewWhen',
      label: 'Flag for review when',
      rows: 2,
      placeholder: 'e.g. ambiguous location, could match more than one group',
    },
    { key: 'exampleMessage', label: 'Example message', rows: 2 },
    {
      key: 'exampleDestination',
      label: 'Example destination(s)',
      rows: 2,
      placeholder: 'chat title or chatId the example should route to',
    },
    {
      key: 'fallbackBehavior',
      label: 'When no clear match',
      rows: 2,
      placeholder: 'e.g. skip, pick default group, or flag for review',
    },
  ],
};

export const STRUCTURED_POLICY_INTRO: Record<AgentType, string> = {
  relevance: 'Define what should be forwarded, skipped, or sent to review for this rule.',
  clean: 'Define how message text should be transformed before forwarding.',
  route: 'Define how to choose destination chats (use chat descriptions on the Chats page too).',
};
