export type PipelineAgentRef = { id: string; type: string };

export function movePipelineAgentId(
  agentIds: string[],
  index: number,
  direction: 'up' | 'down',
): string[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= agentIds.length) {
    return agentIds;
  }
  const next = [...agentIds];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export function formatPipelineTypeLabel(type: string): string {
  return type.replace(/_/g, ' ');
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
    .filter((type): type is string => Boolean(type));

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

export function describePipelineOrder(
  agentIds: string[],
  agents: PipelineAgentRef[],
): string | null {
  if (!agentIds.length) {
    return null;
  }
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const labels = agentIds
    .map((id) => byId.get(id)?.type)
    .filter(Boolean)
    .map((type) => formatPipelineTypeLabel(type as string));
  return labels.length ? labels.join(' → ') : null;
}
