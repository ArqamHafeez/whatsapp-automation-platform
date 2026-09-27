import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiService } from '../common/ai/ai.service';
<<<<<<< HEAD
import { ImageEditService } from '../common/image/image-edit.service';
=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a

describe('PipelineService', () => {
  let service: PipelineService;
  let prisma: {
<<<<<<< HEAD
    message: { findUnique: jest.Mock; update: jest.Mock };
=======
    message: { findUnique: jest.Mock };
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
    rule: { findFirst: jest.Mock };
    agent: { findMany: jest.Mock };
    chat: { findMany: jest.Mock };
    pipelineDecision: { create: jest.Mock };
    reviewItem: { create: jest.Mock };
    user: { findUnique: jest.Mock };
    whatsAppConnection: { findFirst: jest.Mock };
  };
  let aiService: {
    runRelevanceAgent: jest.Mock;
    runCleanAgent: jest.Mock;
    runRouteAgent: jest.Mock;
  };

<<<<<<< HEAD
  let imageEditService: { runImageEditAgent: jest.Mock };

=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
  const messageId = 'msg-1';
  const ruleId = 'rule-1';
  const orgId = 'org-1';
  const connectionId = 'conn-1';

  const baseMessage = {
    id: messageId,
    body: 'Hello',
    type: 'text',
    mediaUrl: null,
    sender: 'Alice',
    chatId: '123@c.us',
    connectionId,
  };

  beforeEach(async () => {
    prisma = {
<<<<<<< HEAD
      message: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
=======
      message: { findUnique: jest.fn() },
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
      rule: { findFirst: jest.fn() },
      agent: { findMany: jest.fn() },
      chat: { findMany: jest.fn() },
      pipelineDecision: { create: jest.fn() },
      reviewItem: { create: jest.fn() },
      user: { findUnique: jest.fn() },
      whatsAppConnection: { findFirst: jest.fn() },
    };
    aiService = { runRelevanceAgent: jest.fn(), runCleanAgent: jest.fn(), runRouteAgent: jest.fn() };
<<<<<<< HEAD
    imageEditService = { runImageEditAgent: jest.fn() };
=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiService, useValue: aiService },
<<<<<<< HEAD
        { provide: ImageEditService, useValue: imageEditService },
=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
      ],
    }).compile();

    service = module.get(PipelineService);
    prisma.chat.findMany.mockResolvedValue([]);
    prisma.pipelineDecision.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'decision-1', ...data }),
    );
    prisma.reviewItem.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'review-1', ...data }),
    );
  });

  it('passthrough forwards when rule has no pipeline agents', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      pipelineAgentIds: [],
      destinationChatIds: ['dest-chat-1'],
    });

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('forward');
    if (result.action === 'forward') {
      expect(result.pipelineMode).toBe('passthrough');
    }
    expect(aiService.runRelevanceAgent).not.toHaveBeenCalled();
  });

  it('skips forward when relevance agent marks message not relevant and review is off', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      reviewMode: 'off',
      pipelineAgentIds: ['agent-1'],
      destinationChatIds: ['dest-chat-1'],
    });
    prisma.agent.findMany.mockResolvedValue([
      { id: 'agent-1', name: 'Relevance', type: 'relevance', isActive: true },
    ]);
    aiService.runRelevanceAgent.mockResolvedValue({
      relevant: false,
      reason: 'Off-topic chat',
      confidence: 0.91,
    });

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('skip');
    if (result.action === 'skip') {
      expect(result.reason).toContain('Off-topic');
    }
    expect(prisma.pipelineDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ decisionType: 'skip' }),
      }),
    );
  });

  it('skips on escalation when relevance agent marks message not relevant', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      reviewMode: 'on_escalation',
      reviewTimeoutMinutes: 60,
      pipelineAgentIds: ['agent-1'],
      destinationChatIds: ['dest-chat-1'],
    });
    prisma.agent.findMany.mockResolvedValue([
      { id: 'agent-1', name: 'Relevance', type: 'relevance', isActive: true },
    ]);
    aiService.runRelevanceAgent.mockResolvedValue({
      relevant: false,
      reason: 'Lack of specific job details',
      confidence: 0.62,
    });

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('skip');
    expect(prisma.reviewItem.create).not.toHaveBeenCalled();
  });

  it('skips when relevance rejects before route runs on escalation', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      reviewMode: 'on_escalation',
      reviewTimeoutMinutes: 60,
      pipelineAgentIds: ['agent-rel', 'agent-route'],
      destinationChatIds: ['dest-remote', 'dest-local'],
    });
    prisma.agent.findMany.mockResolvedValue([
      { id: 'agent-rel', name: 'Relevance', type: 'relevance', isActive: true },
      { id: 'agent-route', name: 'Router', type: 'route', isActive: true },
    ]);
    aiService.runRelevanceAgent.mockResolvedValue({
      relevant: false,
      reason: 'Lack of specific job details',
      confidence: 0.62,
    });

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('skip');
    expect(aiService.runRouteAgent).not.toHaveBeenCalled();
    expect(prisma.reviewItem.create).not.toHaveBeenCalled();
  });

  it('skips confident irrelevant message on escalation without review', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      reviewMode: 'on_escalation',
      reviewTimeoutMinutes: 60,
      pipelineAgentIds: ['agent-1'],
      destinationChatIds: ['dest-chat-1'],
    });
    prisma.agent.findMany.mockResolvedValue([
      { id: 'agent-1', name: 'Relevance', type: 'relevance', isActive: true },
    ]);
    aiService.runRelevanceAgent.mockResolvedValue({
      relevant: false,
      reason: 'Casual chat, not a job',
      confidence: 0.95,
    });

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('skip');
    expect(prisma.reviewItem.create).not.toHaveBeenCalled();
  });

  it('queues review when relevance agent flags needsReview', async () => {
    prisma.message.findUnique.mockResolvedValue({
      ...baseMessage,
      body: 'We might hire Node.js developers in the next few weeks. No apply link or salary yet.',
    });
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      reviewMode: 'on_escalation',
      reviewTimeoutMinutes: 60,
      pipelineAgentIds: ['agent-1'],
      destinationChatIds: ['dest-chat-1'],
    });
    prisma.agent.findMany.mockResolvedValue([
      { id: 'agent-1', name: 'Relevance', type: 'relevance', isActive: true },
    ]);
    aiService.runRelevanceAgent.mockResolvedValue({
      relevant: true,
      reason: 'Possible job posting but missing apply link',
      confidence: 0.72,
      needsReview: true,
    });

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('review');
    expect(prisma.reviewItem.create).toHaveBeenCalledTimes(1);
  });

  it('forwards when relevance agent marks message relevant', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      pipelineAgentIds: ['agent-1'],
      destinationChatIds: ['dest-chat-1'],
    });
    prisma.agent.findMany.mockResolvedValue([
      { id: 'agent-1', name: 'Relevance', type: 'relevance', isActive: true },
    ]);
    aiService.runRelevanceAgent.mockResolvedValue({
      relevant: true,
      reason: 'Contains a job posting',
      confidence: 0.88,
    });

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('forward');
    if (result.action === 'forward') {
      expect(result.pipelineMode).toBe('executed');
    }
  });

  it('fail-open forwards on agent error even when reviewMode is on_escalation', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      reviewMode: 'on_escalation',
      reviewTimeoutMinutes: 60,
      pipelineAgentIds: ['agent-1'],
      destinationChatIds: ['dest-chat-1'],
    });
    prisma.agent.findMany.mockResolvedValue([
      { id: 'agent-1', name: 'Relevance', type: 'relevance', isActive: true },
    ]);
    aiService.runRelevanceAgent.mockRejectedValue(new Error('OpenAI down'));

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('forward');
    if (result.action === 'forward') {
      expect(result.pipelineMode).toBe('fail_open');
    }
    expect(prisma.reviewItem.create).not.toHaveBeenCalled();
  });

  it('fail-open forwards when relevance agent throws and review is off', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      reviewMode: 'off',
      pipelineAgentIds: ['agent-1'],
      destinationChatIds: ['dest-chat-1'],
    });
    prisma.agent.findMany.mockResolvedValue([
      { id: 'agent-1', name: 'Relevance', type: 'relevance', isActive: true },
    ]);
    aiService.runRelevanceAgent.mockRejectedValue(new Error('OpenAI down'));

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('forward');
    if (result.action === 'forward') {
      expect(result.pipelineMode).toBe('fail_open');
    }
  });

  it('forwards cleaned body when clean agent runs after relevance', async () => {
    prisma.message.findUnique.mockResolvedValue({
      ...baseMessage,
      body: 'Forwarded from Jobs Channel\n\nSoftware engineer role at Acme',
    });
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      pipelineAgentIds: ['agent-rel', 'agent-clean'],
      destinationChatIds: ['dest-chat-1'],
    });
    prisma.agent.findMany.mockResolvedValue([
      { id: 'agent-rel', name: 'Relevance', type: 'relevance', isActive: true },
      { id: 'agent-clean', name: 'Cleaner', type: 'clean', isActive: true },
    ]);
    aiService.runRelevanceAgent.mockResolvedValue({
      relevant: true,
      reason: 'Job posting',
      confidence: 0.9,
    });
    aiService.runCleanAgent.mockResolvedValue({
      cleanedText: 'Software engineer role at Acme',
      changes: ['Removed forwarding header'],
      unchanged: false,
    });

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('forward');
    if (result.action === 'forward') {
      expect(result.body).toBe('Software engineer role at Acme');
    }
    expect(aiService.runCleanAgent).toHaveBeenCalledTimes(1);
    expect(prisma.pipelineDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: 'Software engineer role at Acme',
        }),
      }),
    );
  });

<<<<<<< HEAD
  it('runs clean before relevance when pipeline order is reversed', async () => {
    prisma.message.findUnique.mockResolvedValue({
      ...baseMessage,
      body: 'Forwarded from Jobs Channel\n\nSoftware engineer role at Acme',
    });
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      pipelineAgentIds: ['agent-clean', 'agent-rel'],
      destinationChatIds: ['dest-chat-1'],
    });
    prisma.agent.findMany.mockResolvedValue([
      { id: 'agent-clean', name: 'Cleaner', type: 'clean', isActive: true },
      { id: 'agent-rel', name: 'Relevance', type: 'relevance', isActive: true },
    ]);
    aiService.runCleanAgent.mockResolvedValue({
      cleanedText: 'Software engineer role at Acme',
      changes: ['Removed forwarding header'],
      unchanged: false,
    });
    aiService.runRelevanceAgent.mockResolvedValue({
      relevant: true,
      reason: 'Job posting',
      confidence: 0.9,
    });

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('forward');
    expect(aiService.runCleanAgent.mock.invocationCallOrder[0]).toBeLessThan(
      aiService.runRelevanceAgent.mock.invocationCallOrder[0],
    );
  });

=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
  it('skips clean agent when message has no text body', async () => {
    prisma.message.findUnique.mockResolvedValue({
      ...baseMessage,
      body: '',
      type: 'image',
      mediaUrl: 'data:image/png;base64,abc',
    });
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      pipelineAgentIds: ['agent-clean'],
      destinationChatIds: ['dest-chat-1'],
    });
    prisma.agent.findMany.mockResolvedValue([
      { id: 'agent-clean', name: 'Cleaner', type: 'clean', isActive: true },
    ]);

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('forward');
    expect(aiService.runCleanAgent).not.toHaveBeenCalled();
  });

  it('forwards to route-selected subset of destinations', async () => {
    prisma.message.findUnique.mockResolvedValue({
      ...baseMessage,
      body: 'Remote software engineer role',
    });
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      pipelineAgentIds: ['agent-route'],
      destinationChatIds: ['dest-remote', 'dest-local'],
    });
    prisma.agent.findMany.mockResolvedValue([
      { id: 'agent-route', name: 'Router', type: 'route', isActive: true },
    ]);
    prisma.chat.findMany.mockResolvedValue([
      {
        id: 'dest-remote',
        title: 'Remote Jobs',
        externalChatId: '111@g.us',
        type: 'GROUP',
        metadata: null,
      },
      {
        id: 'dest-local',
        title: 'Local Jobs',
        externalChatId: '222@g.us',
        type: 'GROUP',
        metadata: null,
      },
    ]);
    aiService.runRouteAgent.mockResolvedValue({
      destinationChatIds: ['dest-remote'],
      reason: 'Remote role fits remote jobs group',
      confidence: 0.92,
    });

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('forward');
    if (result.action === 'forward') {
      expect(result.destinationChatIds).toEqual(['dest-remote']);
    }
    expect(aiService.runRouteAgent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'agent-route' }),
      expect.any(Object),
      ['dest-remote', 'dest-local'],
    );
    expect(prisma.pipelineDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          destinations: ['dest-remote'],
        }),
      }),
    );
  });

  it('skips when route agent selects no destinations', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      pipelineAgentIds: ['agent-route'],
      destinationChatIds: ['dest-remote', 'dest-local'],
    });
    prisma.agent.findMany.mockResolvedValue([
      { id: 'agent-route', name: 'Router', type: 'route', isActive: true },
    ]);
    aiService.runRouteAgent.mockResolvedValue({
      destinationChatIds: [],
      reason: 'No destination matches this content',
      confidence: 0.8,
    });

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('skip');
    if (result.action === 'skip') {
      expect(result.reason).toContain('No destination matches');
    }
  });

  it('skips route agent when rule has only one destination', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      pipelineAgentIds: ['agent-route'],
      destinationChatIds: ['dest-chat-1'],
    });
    prisma.agent.findMany.mockResolvedValue([
      { id: 'agent-route', name: 'Router', type: 'route', isActive: true },
    ]);

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('forward');
    expect(aiService.runRouteAgent).not.toHaveBeenCalled();
  });

  it('queues review when rule reviewMode is always', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.rule.findFirst.mockResolvedValue({
      id: ruleId,
      name: 'Jobs rule',
      description: null,
      reviewMode: 'always',
      reviewTimeoutMinutes: 60,
      pipelineAgentIds: [],
      destinationChatIds: ['dest-chat-1'],
    });

    const result = await service.runForRule({
      messageId,
      ruleId,
      orgId,
      connectionId,
    });

    expect(result.action).toBe('review');
    if (result.action === 'review') {
      expect(result.reason).toContain('always');
    }
    expect(prisma.reviewItem.create).toHaveBeenCalledTimes(1);
    expect(prisma.pipelineDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ decisionType: 'review' }),
      }),
    );
  });

  it('throws when message is missing', async () => {
    prisma.message.findUnique.mockResolvedValue(null);

    await expect(
      service.runForRule({ messageId, ruleId, orgId, connectionId }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
