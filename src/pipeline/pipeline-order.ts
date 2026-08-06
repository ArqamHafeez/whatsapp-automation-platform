import { AgentType } from '@prisma/client';

/** v1 fixed pipeline order per specification §3.1 */
export const V1_PIPELINE_AGENT_TYPES: AgentType[] = ['relevance', 'clean', 'route'];

export function normalizePipelineAgentIds(
  agentIds: string[],
  agents: Array<{ id: string; type: AgentType }>,
): string[] {
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const selected = agentIds.filter((id) => byId.has(id));
  const ordered: string[] = [];

  for (const type of V1_PIPELINE_AGENT_TYPES) {
    for (const id of selected) {
      if (byId.get(id)?.type === type) {
        ordered.push(id);
      }
    }
  }

  return ordered;
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
    if (!V1_PIPELINE_AGENT_TYPES.includes(agent.type)) {
      throw new Error(`Pipeline agent type "${agent.type}" is not supported in v1`);
    }
  }

  const typeCounts = new Map<AgentType, number>();
  for (const id of agentIds) {
    const type = byId.get(id)!.type;
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }
  for (const [type, count] of typeCounts) {
    if (count > 1) {
      throw new Error(`Only one agent of type "${type}" is allowed per pipeline in v1`);
    }
  }
}
