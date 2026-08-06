import { Agent, AgentType } from '@prisma/client';

export type RelevanceStructuredConfig = {
  inclusionCriteria?: string;
  exclusionCriteria?: string;
  reviewWhen?: string;
  exampleRelevant?: string;
  exampleIrrelevant?: string;
};

export type CleanStructuredConfig = {
  removeWhen?: string;
  preserveWhen?: string;
  outputStyle?: string;
  leaveUnchangedWhen?: string;
  exampleBefore?: string;
  exampleAfter?: string;
};

export type RouteStructuredConfig = {
  routingRules?: string;
  sendToMultipleWhen?: string;
  reviewWhen?: string;
  exampleMessage?: string;
  exampleDestination?: string;
  fallbackBehavior?: string;
};

export type AgentStructuredConfig =
  | RelevanceStructuredConfig
  | CleanStructuredConfig
  | RouteStructuredConfig;

const RELEVANCE_KEYS: (keyof RelevanceStructuredConfig)[] = [
  'inclusionCriteria',
  'exclusionCriteria',
  'reviewWhen',
  'exampleRelevant',
  'exampleIrrelevant',
];

const CLEAN_KEYS: (keyof CleanStructuredConfig)[] = [
  'removeWhen',
  'preserveWhen',
  'outputStyle',
  'leaveUnchangedWhen',
  'exampleBefore',
  'exampleAfter',
];

const ROUTE_KEYS: (keyof RouteStructuredConfig)[] = [
  'routingRules',
  'sendToMultipleWhen',
  'reviewWhen',
  'exampleMessage',
  'exampleDestination',
  'fallbackBehavior',
];

function pickStringFields(
  raw: Record<string, unknown>,
  keys: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) {
      out[key] = value.trim();
    }
  }
  return out;
}

export function sanitizeStructuredConfig(
  type: AgentType,
  config: Record<string, unknown> | undefined | null,
): Record<string, string> | undefined {
  if (!config || typeof config !== 'object') {
    return undefined;
  }
  const raw = config as Record<string, unknown>;
  let keys: readonly string[];
  if (type === 'clean') {
    keys = CLEAN_KEYS;
  } else if (type === 'route') {
    keys = ROUTE_KEYS;
  } else {
    keys = RELEVANCE_KEYS;
  }
  const sanitized = pickStringFields(raw, keys);
  return Object.keys(sanitized).length ? sanitized : undefined;
}

export function readRelevanceStructuredConfig(agent: Agent): RelevanceStructuredConfig {
  if (!agent.structuredConfig || typeof agent.structuredConfig !== 'object') {
    return {};
  }
  return pickStringFields(agent.structuredConfig as Record<string, unknown>, RELEVANCE_KEYS);
}

export function readCleanStructuredConfig(agent: Agent): CleanStructuredConfig {
  if (!agent.structuredConfig || typeof agent.structuredConfig !== 'object') {
    return {};
  }
  return pickStringFields(agent.structuredConfig as Record<string, unknown>, CLEAN_KEYS);
}

export function readRouteStructuredConfig(agent: Agent): RouteStructuredConfig {
  if (!agent.structuredConfig || typeof agent.structuredConfig !== 'object') {
    return {};
  }
  return pickStringFields(agent.structuredConfig as Record<string, unknown>, ROUTE_KEYS);
}

function buildRelevancePromptBlock(config: RelevanceStructuredConfig): string {
  const lines: string[] = [];
  if (config.inclusionCriteria) lines.push(`Forward when: ${config.inclusionCriteria}`);
  if (config.exclusionCriteria) lines.push(`Drop/skip when: ${config.exclusionCriteria}`);
  if (config.reviewWhen) lines.push(`Flag needsReview when: ${config.reviewWhen}`);
  if (config.exampleRelevant) lines.push(`Example relevant message:\n${config.exampleRelevant}`);
  if (config.exampleIrrelevant) lines.push(`Example irrelevant message:\n${config.exampleIrrelevant}`);
  return lines.length ? `\n\nStructured relevance policy:\n${lines.join('\n\n')}` : '';
}

function buildCleanPromptBlock(config: CleanStructuredConfig): string {
  const lines: string[] = [];
  if (config.removeWhen) lines.push(`Remove/strip when: ${config.removeWhen}`);
  if (config.preserveWhen) lines.push(`Always preserve: ${config.preserveWhen}`);
  if (config.outputStyle) lines.push(`Output style: ${config.outputStyle}`);
  if (config.leaveUnchangedWhen) lines.push(`Leave unchanged when: ${config.leaveUnchangedWhen}`);
  if (config.exampleBefore && config.exampleAfter) {
    lines.push(`Example before:\n${config.exampleBefore}\n\nExample after:\n${config.exampleAfter}`);
  } else if (config.exampleBefore) {
    lines.push(`Example before:\n${config.exampleBefore}`);
  } else if (config.exampleAfter) {
    lines.push(`Example after:\n${config.exampleAfter}`);
  }
  return lines.length ? `\n\nStructured cleaning policy:\n${lines.join('\n\n')}` : '';
}

function buildRoutePromptBlock(config: RouteStructuredConfig): string {
  const lines: string[] = [];
  if (config.routingRules) lines.push(`Routing rules: ${config.routingRules}`);
  if (config.sendToMultipleWhen) lines.push(`Send to multiple destinations when: ${config.sendToMultipleWhen}`);
  if (config.reviewWhen) lines.push(`Flag for human review when: ${config.reviewWhen}`);
  if (config.fallbackBehavior) lines.push(`When no destination clearly matches: ${config.fallbackBehavior}`);
  if (config.exampleMessage && config.exampleDestination) {
    lines.push(
      `Example routing:\nMessage: ${config.exampleMessage}\nDestination(s): ${config.exampleDestination}`,
    );
  } else if (config.exampleMessage) {
    lines.push(`Example message to route:\n${config.exampleMessage}`);
  } else if (config.exampleDestination) {
    lines.push(`Example destination choice:\n${config.exampleDestination}`);
  }
  return lines.length ? `\n\nStructured routing policy:\n${lines.join('\n\n')}` : '';
}

/** @deprecated use readRelevanceStructuredConfig — kept for callers expecting generic read */
export function readStructuredConfig(agent: Agent): RelevanceStructuredConfig {
  return readRelevanceStructuredConfig(agent);
}

export function buildStructuredConfigPromptBlock(agent: Agent): string {
  if (agent.type === 'clean') {
    return buildCleanPromptBlock(readCleanStructuredConfig(agent));
  }
  if (agent.type === 'route') {
    return buildRoutePromptBlock(readRouteStructuredConfig(agent));
  }
  return buildRelevancePromptBlock(readRelevanceStructuredConfig(agent));
}
