import { describe, expect, it, vi } from 'vitest';
import { SlackMessenger, card, createIncomingWebhookTransport, createWebApiTransport, message } from '../src';

describe('transports', () => {
  it('wraps Slack Web API chat.postMessage clients', async () => {
    const postMessage = vi.fn(async (input: Record<string, unknown>) => ({ ok: true, channel: input.channel, ts: '123.456' }));
    const transport = createWebApiTransport({ chat: { postMessage } });
    const result = await transport.postMessage({ channel: 'C123', text: 'hello', blocks: [] });

    expect(result).toEqual({ ok: true, channel: 'C123', ts: '123.456', error: undefined, raw: { ok: true, channel: 'C123', ts: '123.456' } });
    expect(postMessage).toHaveBeenCalledWith({ channel: 'C123', text: 'hello', blocks: [] });
  });

  it('normalizes Slack Web API error responses', async () => {
    const transport = createWebApiTransport({ chat: { postMessage: vi.fn(async () => ({ ok: false, error: 'channel_not_found' })) } });
    const result = await transport.postMessage({ channel: 'BAD', text: 'hello', blocks: [] });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('channel_not_found');
    expect(() => createWebApiTransport({} as never)).toThrow('chat.postMessage');
  });

  it('posts via incoming webhooks with explicit fetch implementations', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, text: async () => 'ok' }));
    const transport = createIncomingWebhookTransport('https://hooks.slack.com/services/T/X/Y', fetchImpl);
    const result = await transport.postMessage({ channel: 'C123', text: 'hello', blocks: [] });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('https://hooks.slack.com/services/T/X/Y', expect.objectContaining({ method: 'POST' }));
    const calls = fetchImpl.mock.calls as unknown as Array<[string, { body: string }]>;
    expect(JSON.parse(calls[0]![1].body).text).toBe('hello');
  });

  it('handles incoming webhook failures and constructor validation', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, text: async () => 'server_error' }));
    const transport = createIncomingWebhookTransport('https://hooks.slack.com/services/T/X/Y', fetchImpl);
    const result = await transport.postMessage({ channel: 'C123', text: 'hello', blocks: [] });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('server_error');
    expect(() => createIncomingWebhookTransport('')).toThrow('webhookUrl');
  });

  it('uses SlackMessenger to send builders, components, and payloads', async () => {
    const transport = { postMessage: vi.fn(async (input) => ({ ok: true, channel: input.channel, ts: '1', raw: input })) };
    const messenger = new SlackMessenger(transport);

    const builderResult = await messenger.send('C123', message().card({ title: 'Builder', body: 'hello' }), { threadTs: '0.1', replyBroadcast: true });
    expect(builderResult.ok).toBe(true);
    expect(transport.postMessage.mock.calls[0]?.[0].thread_ts).toBe('0.1');
    expect(transport.postMessage.mock.calls[0]?.[0].reply_broadcast).toBe(true);

    await messenger.send('C123', card({ title: 'Component' }));
    await messenger.send('C123', { text: 'Payload', blocks: [{ type: 'divider' }] });
    expect(transport.postMessage).toHaveBeenCalledTimes(3);
  });

  it('validates payloads before sending', async () => {
    const transport = { postMessage: vi.fn(async (input) => ({ ok: true, raw: input })) };
    const messenger = new SlackMessenger(transport);

    await expect(messenger.send('C123', { text: 'bad', blocks: [{ type: 'section' }] })).rejects.toThrow('section requires text or fields');
    expect(transport.postMessage).not.toHaveBeenCalled();
  });
});
