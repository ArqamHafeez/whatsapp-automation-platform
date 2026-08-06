import { PipelineMode } from '../pipeline/pipeline.types';



export interface ReviewForwardPayload {

  connectionId: string;

  body: string | null;

  type: string;

  mediaUrl: string | null;

  destinationChatIds: string[];

  pipelineMode: PipelineMode;

  reviewReason: string;

  pipelineDecisionId?: string;

}



export function parseReviewForwardPayload(raw: string): ReviewForwardPayload {

  let parsed: unknown;

  try {

    parsed = JSON.parse(raw);

  } catch {

    throw new Error('Review item payload is not valid JSON');

  }



  if (!parsed || typeof parsed !== 'object') {

    throw new Error('Review item payload is invalid');

  }



  const data = parsed as Record<string, unknown>;

  const connectionId = typeof data.connectionId === 'string' ? data.connectionId : '';

  const destinationChatIds = Array.isArray(data.destinationChatIds)

    ? data.destinationChatIds.filter((id): id is string => typeof id === 'string')

    : [];

  const body: string | null =
    typeof data.body === 'string' ? data.body : data.body === null ? null : null;
  const type = typeof data.type === 'string' ? data.type : 'text';
  const mediaUrl: string | null =
    typeof data.mediaUrl === 'string' ? data.mediaUrl : data.mediaUrl === null ? null : null;

  const pipelineMode =

    data.pipelineMode === 'passthrough' ||

    data.pipelineMode === 'executed' ||

    data.pipelineMode === 'fail_open'

      ? data.pipelineMode

      : 'executed';

  const reviewReason = typeof data.reviewReason === 'string' ? data.reviewReason : '';

  const pipelineDecisionId =

    typeof data.pipelineDecisionId === 'string' ? data.pipelineDecisionId : undefined;



  if (!connectionId || !destinationChatIds.length) {

    throw new Error('Review item payload is missing connectionId or destinations');

  }



  return {

    connectionId,

    body,

    type,

    mediaUrl,

    destinationChatIds,

    pipelineMode,

    reviewReason,

    pipelineDecisionId,

  };

}


