import type { SlackMessagePayload, SlackPostMessagePayload, SlackUpdateMessagePayload } from '../types/slack';
import type { BuildOptions, MessageBuilder } from './builder';
import { createMessage } from './builder';
import type { ComponentLike } from './component';
import { assertValidMessage } from './validation';

export interface SlackSendResult {
  ok: boolean;
  channel?: string;
  ts?: string;
  error?: string;
  raw: unknown;
}

export interface SlackTransport {
  postMessage(input: SlackPostMessagePayload): Promise<SlackSendResult>;
  updateMessage?(input: SlackUpdateMessagePayload): Promise<SlackSendResult>;
}

export interface SlackWebApiClientLike {
  chat: {
    // Slack SDK versions expose strongly typed overloads; `any` keeps this adapter
    // compatible without making @slack/web-api a runtime dependency.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    postMessage(input: any): Promise<unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update?(input: any): Promise<unknown>;
  };
}

export interface SendOptions extends BuildOptions {
  threadTs?: string;
  replyBroadcast?: boolean;
}

export type UpdateOptions = BuildOptions;

type Buildable = Pick<MessageBuilder, 'build'>;
type MessageInput = SlackMessagePayload | ComponentLike | Buildable;

function isPayload(input: MessageInput): input is SlackMessagePayload {
  return Boolean(input && typeof input === 'object' && Array.isArray((input as SlackMessagePayload).blocks));
}

function isBuildable(input: MessageInput): input is Buildable {
  return Boolean(input && typeof input === 'object' && typeof (input as Buildable).build === 'function');
}

function normalizeMessage(input: MessageInput, options: BuildOptions = {}): SlackMessagePayload {
  if (isPayload(input)) return input;
  if (isBuildable(input)) return input.build(options);
  return createMessage([input as ComponentLike], options);
}

function normalizeWebApiResult(raw: unknown): SlackSendResult {
  const result = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const ok = Boolean(result.ok);
  return {
    ok,
    channel: typeof result.channel === 'string' ? result.channel : undefined,
    ts: typeof result.ts === 'string' ? result.ts : undefined,
    error: ok ? undefined : String(result.error ?? 'unknown_error'),
    raw
  };
}

export class SlackMessenger {
  constructor(private readonly transport: SlackTransport) {}

  async send(channel: string, input: MessageInput, options: SendOptions = {}): Promise<SlackSendResult> {
    const payload = normalizeMessage(input, options);
    assertValidMessage(payload);
    return this.transport.postMessage({
      ...payload,
      channel,
      ...(options.threadTs ? { thread_ts: options.threadTs } : {}),
      ...(options.replyBroadcast !== undefined ? { reply_broadcast: options.replyBroadcast } : {})
    });
  }

  async update(channel: string, ts: string, input: MessageInput, options: UpdateOptions = {}): Promise<SlackSendResult> {
    if (!this.transport.updateMessage) throw new Error('Slack transport does not support chat.update');
    const payload = normalizeMessage(input, options);
    assertValidMessage(payload);
    return this.transport.updateMessage({ ...payload, channel, ts });
  }
}

export function createWebApiTransport(client: SlackWebApiClientLike): SlackTransport {
  if (!client?.chat?.postMessage) throw new Error('createWebApiTransport requires a Slack Web API client with chat.postMessage');
  return {
    async postMessage(input) {
      return normalizeWebApiResult(await client.chat.postMessage(input));
    },
    async updateMessage(input) {
      if (!client.chat.update) throw new Error('createWebApiTransport requires a Slack Web API client with chat.update to update messages');
      return normalizeWebApiResult(await client.chat.update(input));
    }
  };
}

export interface FetchResponseLike { ok: boolean; status: number; text(): Promise<string>; }
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<FetchResponseLike>;

export function createIncomingWebhookTransport(webhookUrl: string, fetchImpl?: FetchLike): SlackTransport {
  if (!webhookUrl) throw new Error('createIncomingWebhookTransport requires a webhookUrl');
  const fetcher = fetchImpl ?? (globalThis.fetch as unknown as FetchLike | undefined);
  if (!fetcher) throw new Error('No fetch implementation is available. Pass fetchImpl explicitly.');
  return {
    async postMessage(input) {
      const response = await fetcher(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const body = await response.text();
      const ok = response.ok && body.trim() === 'ok';
      return { ok, error: ok ? undefined : body || `HTTP ${response.status}`, raw: { status: response.status, body } };
    }
  };
}
