import {ChatOpenAI} from '@langchain/openai';

/** Retries an OpenAI request gets after a rate limit or a server error. */
export const OPENAI_MAX_RETRIES = 2;

/** What a reasoning model returns so its reasoning can be sent back on the next turn without OpenAI storing it. */
export const ENCRYPTED_REASONING = 'reasoning.encrypted_content';

/**
 * Whether a model reasons: the o series and GPT-5 on, but not the chat variants. Unknown models count as not
 * reasoning, which costs them only their reasoning between turns, never the request.
 */
export const isReasoningModel = (model: string): boolean => /^(o\d|gpt-[5-9])/.test(model) && !model.includes('-chat');

/**
 * An OpenAI chat model with zero data retention, the only way agent-engineer calls OpenAI. Every request goes to the
 * Responses API with `store: false` and carries the whole conversation, so OpenAI keeps no response and nothing refers
 * to a stored one. Reasoning models get their reasoning back encrypted, to send with the next turn. Keys from an
 * organization with zero data retention require this, and every key accepts it.
 */
export const createOpenAIModel = (model: string): ChatOpenAI => new ChatOpenAI({
    model,
    useResponsesApi: true,
    zdrEnabled: true,
    maxRetries: OPENAI_MAX_RETRIES,
    ...(isReasoningModel(model) ? {modelKwargs: {include: [ENCRYPTED_REASONING]}} : {}),
});
