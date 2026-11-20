import { fork } from 'node:child_process';
import { on, once } from 'node:events';
import { Agent, get, type IncomingMessage } from 'node:http';
import { text } from 'node:stream/consumers';
import { expect, it, onTestFinished } from 'vitest';

async function startServer(shutdownTimeoutMs: number) {
  const child = fork(new URL('./server.fixture.ts', import.meta.url), [String(shutdownTimeoutMs)], {
    execArgv: ['--experimental-strip-types'],
  });
  const messages = on(child, 'message', { close: ['exit'] });
  const exited = once(child, 'exit');
  const agent = new Agent({ keepAlive: true, maxSockets: 1 });
  onTestFinished(async () => {
    agent.destroy();
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited;
  });

  async function nextMessage(): Promise<unknown> {
    const message = await messages.next();
    if (message.done) throw new Error('Shutdown fixture exited before reporting its next event');
    return message.value[0];
  }

  const port = await nextMessage();
  if (typeof port !== 'number') throw new Error('Shutdown fixture did not report a port');
  const request = async (path: string, useKeepAlive = true) => {
    const req = get({ hostname: '127.0.0.1', port, path, agent: useKeepAlive ? agent : false });
    const [res] = await once(req, 'response');
    return { response: res as IncomingMessage, reusedSocket: req.reusedSocket };
  };
  return { child, exited, nextMessage, request };
}

it('fails readiness first, refuses new connections and completes work on a reused socket', async () => {
  const timeout = 5_000;
  const { child, exited, nextMessage, request } = await startServer(timeout);
  const { response: ready } = await request('/health/ready');
  expect(ready.statusCode).toBe(200);
  expect(await text(ready)).toBe('');

  const { response: work, reusedSocket } = await request('/work');
  expect(reusedSocket).toBe(true);
  expect(work.headers.connection).toBe('keep-alive');
  const probe = request('/health/ready?at=drain', false);
  expect(await nextMessage()).toBe('probe armed');

  const started = performance.now();
  child.kill('SIGTERM');
  expect(await nextMessage()).toEqual({ listeningAtReadinessChange: true });
  const { response: draining } = await probe;
  expect(draining.statusCode).toBe(503);
  expect(await text(draining)).toBe('');
  await expect(request('/health/ready', false)).rejects.toMatchObject({ code: 'ECONNREFUSED' });

  child.send('complete work');
  expect(await text(work)).toBe('started\ncompleted\n');
  expect(await nextMessage()).toBe('drained');
  expect(await exited).toEqual([0, null]);
  expect(performance.now() - started).toBeLessThan(timeout);
}, 15_000);

it('closes the active connection at the deadline if work never completes', async () => {
  const { child, exited, nextMessage, request } = await startServer(100);
  const { response } = await request('/work');
  const interrupted = expect(text(response)).rejects.toMatchObject({ code: 'ECONNRESET' });
  const started = performance.now();
  child.kill('SIGINT');
  expect(await nextMessage()).toBe('deadline');
  await interrupted;
  expect(performance.now() - started).toBeGreaterThanOrEqual(90);
  expect(await exited).toEqual([0, null]);
}, 15_000);
