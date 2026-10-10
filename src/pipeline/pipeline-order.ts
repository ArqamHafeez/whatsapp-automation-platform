import { AgentType } from '@prisma/client';

/** Agent types that can appear in a rule pipeline (execution order is user-defined). */
export const SUPPORTED_PIPELINE_AGENT_TYPES: AgentType[] = [
  'relevance',
  'image_edit',
  'clean',
  'route',
];

export type PipelineAgentRef = { id: string; type: AgentType };

/** Preserve caller order; drop duplicate IDs (first occurrence wins). */
export function resolvePipelineAgentIds(agentIds: string[]): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const id of agentIds) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    resolved.push(id);
  }
  return resolved;
}

export function assertPipelineAgentIdsValid(
  agentIds: string[],
  agents: Array<{ id: string; type: AgentType; isActive: boolean }>,
): void {
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  for (const id of agentIds) {
    const agent = byId.get(id);
    if (!agent) {
      throw new Error(`Pipeline agent ${id} not found`);
    }
    if (!agent.isActive) {
      throw new Error(`Pipeline agent ${agent.id} is inactive`);
    }
    if (!SUPPORTED_PIPELINE_AGENT_TYPES.includes(agent.type)) {
      throw new Error(`Pipeline agent type "${agent.type}" is not supported in the pipeline`);
    }
  }

  const typeCounts = new Map<AgentType, number>();
  for (const id of agentIds) {
    const type = byId.get(id)!.type;
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }
  for (const [type, count] of typeCounts) {
    if (count > 1) {
      throw new Error(`Only one agent of type "${type}" is allowed per pipeline`);
    }
  }
}

export function getPipelineWarnings(
  agentIds: string[],
  agents: PipelineAgentRef[],
): string[] {
  if (!agentIds.length) {
    return [];
  }

  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const orderedTypes = agentIds
    .map((id) => byId.get(id)?.type)
    .filter((type): type is AgentType => Boolean(type));

  const warnings: string[] = [];

  const routeIndex = orderedTypes.lastIndexOf('route');
  if (routeIndex >= 0 && routeIndex !== orderedTypes.length - 1) {
    warnings.push('Route agent is usually placed last — later steps may not affect routing.');
  }

  if (!orderedTypes.includes('relevance')) {
    warnings.push('No relevance agent — messages will not be filtered for topical fit.');
  }

  const relevanceIndex = orderedTypes.indexOf('relevance');
  const imageEditIndex = orderedTypes.indexOf('image_edit');
  if (relevanceIndex >= 0 && imageEditIndex >= 0 && imageEditIndex < relevanceIndex) {
    warnings.push('Image edit runs before relevance — irrelevant images may still be edited.');
  }

  return warnings;
}

/** @deprecated Use resolvePipelineAgentIds — fixed type order is no longer applied. */
export function normalizePipelineAgentIds(
  agentIds: string[],
  agents: Array<{ id: string; type: AgentType }>,
): string[] {
  void agents;
  return resolvePipelineAgentIds(agentIds);
}
