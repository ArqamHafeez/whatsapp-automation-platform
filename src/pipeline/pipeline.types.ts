export type PipelineAction = 'forward' | 'skip' | 'review';

export type PipelineMode = 'passthrough' | 'executed' | 'fail_open';

export interface PipelineForwardResult {
  action: 'forward';
  destinationChatIds: string[];
  body: string | null;
  type: string;
  mediaUrl: string | null;
  pipelineMode: PipelineMode;
  decisionId: string;
}

export interface PipelineSkipResult {
  action: 'skip';
  reason: string;
  pipelineMode: PipelineMode;
  decisionId: string;
}

export interface PipelineReviewResult {
  action: 'review';
  reason: string;
  pipelineMode: PipelineMode;
  decisionId: string;
  reviewItemId: string;
  destinationChatIds: string[];
  body: string | null;
  type: string;
  mediaUrl: string | null;
}

export type PipelineRunResult = PipelineForwardResult | PipelineSkipResult | PipelineReviewResult;

export interface PipelineRunInput {
  messageId: string;
  ruleId: string;
  orgId: string;
  connectionId: string;
}

export interface PipelineStepLog {
  agentId: string;
  agentName: string;
  agentType: string;
  status: 'completed' | 'skipped_type' | 'error';
  output?: unknown;
  error?: string;
  note?: string;
}
