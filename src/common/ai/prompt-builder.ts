import { Agent } from '@prisma/client';
import { AgentRunContext } from './ai.types';
import { buildStructuredConfigPromptBlock } from './structured-config';

function replaceTokens(template: string, tokens: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(tokens)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

export function buildDefaultCleanUserPrompt(context: AgentRunContext): string {
  const lines = [
    `Rule: ${context.rule.name}`,
    context.rule.description ? `Rule description: ${context.rule.description}` : null,
    context.sourceChat?.title ? `Source chat: ${context.sourceChat.title}` : null,
    context.sourceChat?.description ? `Source description: ${context.sourceChat.description}` : null,
    `Message type: ${context.message.type}`,
    `Original message body:\n${context.message.body?.trim() || '(empty)'}`,
    'Remove competitor branding, forwarding headers, unwanted watermarks in text, and extra promo lines.',
    'Preserve factual announcement content. Do not invent new facts.',
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildDefaultRelevanceUserPrompt(context: AgentRunContext): string {
  const lines = [
    `Rule: ${context.rule.name}`,
    context.rule.description ? `Rule description: ${context.rule.description}` : null,
    context.sourceChat?.title ? `Source chat: ${context.sourceChat.title}` : null,
    context.sourceChat?.description ? `Source description: ${context.sourceChat.description}` : null,
    context.sourceChat?.externalChatId ? `Source JID: ${context.sourceChat.externalChatId}` : null,
    `Sender: ${context.message.sender}`,
    `Message type: ${context.message.type}`,
    `Message body: ${context.message.body?.trim() || '(empty)'}`,
    context.message.mediaUrl ? 'This message includes media (caption/body above may describe it).' : null,
    context.message.type === 'image' && context.message.mediaUrl
      ? 'An image is attached — inspect it for watermarks/branding from another page or channel.'
      : null,
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildDefaultRouteUserPrompt(context: AgentRunContext): string {
  const destLines =
    context.destinationChats?.map(
      (chat) =>
        `- chatId: ${chat.id} | title: ${chat.title?.trim() || '(untitled)'} | description: ${chat.description?.trim() || '(none)'} | type: ${chat.type} | jid: ${chat.externalChatId}`,
    ) ?? [];

  const lines = [
    `Rule: ${context.rule.name}`,
    context.rule.description ? `Rule description: ${context.rule.description}` : null,
    context.sourceChat?.title ? `Source chat: ${context.sourceChat.title}` : null,
    context.sourceChat?.description ? `Source description: ${context.sourceChat.description}` : null,
    `Message type: ${context.message.type}`,
    `Message body:\n${context.message.body?.trim() || '(empty)'}`,
    '',
    'Destination options (return only chatId values from this list):',
    ...(destLines.length ? destLines : ['(none configured)']),
    '',
    'Pick one or more destinations that best fit this message.',
    'IMPORTANT: destinationChatIds must contain exact chatId UUID values from the list above (e.g. "a1b2c3d4-..."), NOT WhatsApp group titles.',
  ];

  return lines.join('\n');
}

export const DEFAULT_RELEVANCE_SYSTEM_PROMPT = `You classify inbound WhatsApp messages for a forwarding automation rule. Respond with JSON only.

Use the rule description and source/destination context in the user message as the primary policy.
- Mark relevant:true when the message matches what the rule description asks to forward.
- Mark relevant:false when it is noise/spam/off-topic per the rule description.
- Set needsReview:true when the message might match but is uncertain or missing key details described in the rule.
- For image messages: set detectedWatermark:true if you see another page/channel watermark or branding overlay (read-only detection — do not describe pixel editing).
- Use confidence 0.85+ when clearly relevant or clearly irrelevant; lower confidence when uncertain.`;

export const DEFAULT_CLEAN_SYSTEM_PROMPT =
  'You clean inbound WhatsApp message text before it is forwarded. Remove branding, promo lines, and forwarding boilerplate while keeping the useful content. Do not invent facts. Respond with JSON only.';

export const DEFAULT_ROUTE_SYSTEM_PROMPT =
  'You route inbound WhatsApp messages to the best destination chat(s) for a forwarding rule. Use each destination title and description to decide, but in destinationChatIds return ONLY the exact chatId UUID strings from the list — never group titles or names. Respond with JSON only.';

<<<<<<< HEAD
export const DEFAULT_IMAGE_EDIT_SYSTEM_PROMPT = `You locate watermark and branding overlay regions on WhatsApp-forwarded images. Respond with JSON only.

Return normalized bounding boxes (0-1 coordinates relative to image width/height) for logos, channel names, "forwarded from" stamps, and corner branding.
Set hasWatermark:true when any overlay should be removed before re-posting.
Do not describe pixel editing steps — only detection boxes.`;

export function buildDefaultImageEditUserPrompt(context: AgentRunContext): string {
  const lines = [
    `Rule: ${context.rule.name}`,
    context.rule.description ? `Rule description: ${context.rule.description}` : null,
    context.sourceChat?.title ? `Source chat: ${context.sourceChat.title}` : null,
    `Message caption: ${context.message.body?.trim() || '(empty)'}`,
    'Locate watermark/branding regions to remove before forwarding this image.',
  ].filter(Boolean);
  return lines.join('\n');
}

=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
export function buildAgentPrompts(
  agent: Agent,
  context: AgentRunContext,
  defaultUserPrompt: string,
): { systemPrompt: string; userPrompt: string } {
  if (agent.advancedPromptOverride?.trim()) {
    return {
      systemPrompt: agent.advancedPromptOverride.trim() + buildStructuredConfigPromptBlock(agent),
      userPrompt: defaultUserPrompt,
    };
  }

  const tokens: Record<string, string> = {
    body: context.message.body?.trim() || '',
    ruleName: context.rule.name,
    ruleDescription: context.rule.description?.trim() || '',
    sender: context.message.sender,
    chatId: context.message.chatId,
    sourceChatTitle: context.sourceChat?.title?.trim() || '',
    sourceChatDescription: context.sourceChat?.description?.trim() || '',
    messageType: context.message.type,
  };

  const defaultSystemByType: Record<string, string> = {
    relevance: DEFAULT_RELEVANCE_SYSTEM_PROMPT,
    clean: DEFAULT_CLEAN_SYSTEM_PROMPT,
    route: DEFAULT_ROUTE_SYSTEM_PROMPT,
<<<<<<< HEAD
    image_edit: DEFAULT_IMAGE_EDIT_SYSTEM_PROMPT,
=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
  };

  const defaultSystem =
    defaultSystemByType[agent.type] ??
    'You process inbound WhatsApp messages for a forwarding automation rule. Respond with JSON only.';

  const baseSystem = agent.systemPrompt?.trim()
    ? replaceTokens(agent.systemPrompt.trim(), tokens)
    : defaultSystem;

  const systemPrompt = baseSystem + buildStructuredConfigPromptBlock(agent);

  const userPrompt = agent.userPromptTemplate?.trim()
    ? replaceTokens(agent.userPromptTemplate.trim(), tokens)
    : defaultUserPrompt;

  return { systemPrompt, userPrompt };
}
