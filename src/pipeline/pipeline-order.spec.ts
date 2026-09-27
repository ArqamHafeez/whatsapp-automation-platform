import { AgentType } from '@prisma/client';
import {
  assertPipelineAgentIdsValid,
  getPipelineWarnings,
  resolvePipelineAgentIds,
} from './pipeline-order';

const agents = [
  { id: 'a-rel', type: 'relevance' as AgentType, isActive: true },
  { id: 'a-img', type: 'image_edit' as AgentType, isActive: true },
  { id: 'a-clean', type: 'clean' as AgentType, isActive: true },
  { id: 'a-route', type: 'route' as AgentType, isActive: true },
];

describe('resolvePipelineAgentIds', () => {
  it('preserves user-defined order', () => {
    expect(resolvePipelineAgentIds(['a-clean', 'a-rel', 'a-route'])).toEqual([
      'a-clean',
      'a-rel',
      'a-route',
    ]);
  });

  it('dedupes duplicate ids keeping first occurrence', () => {
    expect(resolvePipelineAgentIds(['a-rel', 'a-clean', 'a-rel'])).toEqual(['a-rel', 'a-clean']);
  });
});

describe('assertPipelineAgentIdsValid', () => {
  it('accepts composable order', () => {
    expect(() =>
      assertPipelineAgentIdsValid(['a-clean', 'a-rel'], agents),
    ).not.toThrow();
  });

  it('rejects duplicate agent types', () => {
    expect(() =>
      assertPipelineAgentIdsValid(['a-rel', 'b-rel'], [
        ...agents,
        { id: 'b-rel', type: 'relevance', isActive: true },
      ]),
    ).toThrow(/Only one agent of type "relevance"/);
  });

  it('rejects unknown agent id', () => {
    expect(() => assertPipelineAgentIdsValid(['missing'], agents)).toThrow(/not found/);
  });
});

describe('getPipelineWarnings', () => {
  it('warns when route is not last', () => {
    const warnings = getPipelineWarnings(['a-route', 'a-clean'], agents);
    expect(warnings.some((w) => w.includes('Route agent'))).toBe(true);
  });

  it('warns when relevance is missing', () => {
    const warnings = getPipelineWarnings(['a-clean', 'a-route'], agents);
    expect(warnings.some((w) => w.includes('No relevance agent'))).toBe(true);
  });

  it('warns when image edit precedes relevance', () => {
    const warnings = getPipelineWarnings(['a-img', 'a-rel'], agents);
    expect(warnings.some((w) => w.includes('Image edit runs before relevance'))).toBe(true);
  });
});
