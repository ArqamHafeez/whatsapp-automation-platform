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

<<<<<<< HEAD
export type ImageEditStructuredConfig = {
  removePrompt?: string;
  onlyWhenWatermarkDetected?: string;
  reviewOnFailure?: string;
  reviewAfterEdit?: string;
  minConfidence?: string;
};

export type AgentStructuredConfig =
  | RelevanceStructuredConfig
  | CleanStructuredConfig
  | RouteStructuredConfig
  | ImageEditStructuredConfig;
=======
export type AgentStructuredConfig =
  | RelevanceStructuredConfig
  | CleanStructuredConfig
  | RouteStructuredConfig;
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a

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

<<<<<<< HEAD
const IMAGE_EDIT_KEYS: (keyof ImageEditStructuredConfig)[] = [
  'removePrompt',
  'onlyWhenWatermarkDetected',
  'reviewOnFailure',
  'reviewAfterEdit',
  'minConfidence',
];

=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
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
<<<<<<< HEAD
  } else if (type === 'image_edit') {
    keys = IMAGE_EDIT_KEYS;
=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
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

<<<<<<< HEAD
export function readImageEditStructuredConfig(agent: Agent): ImageEditStructuredConfig {
  if (!agent.structuredConfig || typeof agent.structuredConfig !== 'object') {
    return {};
  }
  return pickStringFields(agent.structuredConfig as Record<string, unknown>, IMAGE_EDIT_KEYS);
}

=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
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

<<<<<<< HEAD
function buildImageEditPromptBlock(config: ImageEditStructuredConfig): string {
  const lines: string[] = [];
  if (config.removePrompt) lines.push(`Removal goal: ${config.removePrompt}`);
  if (config.onlyWhenWatermarkDetected === 'true') {
    lines.push('Run only when upstream relevance detected a watermark.');
  }
  if (config.minConfidence) lines.push(`Minimum locate confidence: ${config.minConfidence}`);
  return lines.length ? `\n\nStructured image edit policy:\n${lines.join('\n')}` : '';
}

=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
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
<<<<<<< HEAD
  if (agent.type === 'image_edit') {
    return buildImageEditPromptBlock(readImageEditStructuredConfig(agent));
  }
=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
  return buildRelevancePromptBlock(readRelevanceStructuredConfig(agent));
}
