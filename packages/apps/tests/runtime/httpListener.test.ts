import { createHttpListener } from '@epsilon-asi/apps/runtime';
import { expect, it, onTestFinished } from 'vitest';

function makeListener() {
  const listener = createHttpListener({ handle: (_req, res) => res.end('ready') });
  onTestFinished(() => listener.close());
  return listener;
}

it('rejects a shutdown deadline outside the range of a Node timer', () => {
  for (const shutdownTimeoutMs of [-1, 2.5, 2 ** 31]) {
    expect(() => createHttpListener({ handle: () => {}, shutdownTimeoutMs })).toThrow(/shutdownTimeoutMs/);
  }
});

it('shares pending starts and closes, including a close requested during the first bind', async () => {
  const listener = makeListener();
  const started = listener.listen(0);
  expect(listener.listen(0)).toBe(started);
  const stopped = listener.close();
  expect(listener.draining).toBe(true);
  expect(listener.close()).toBe(stopped);
  const address = await started;
  await stopped;
  await expect(fetch(address)).rejects.toThrow();
  await expect(listener.listen(0)).rejects.toThrow(/closed/);
});

it('can close before listening and leaves the listener permanently closed', async () => {
  const listener = makeListener();
  expect(listener.draining).toBe(false);
  await listener.close();
  expect(listener.draining).toBe(true);
  await expect(listener.listen(0)).rejects.toThrow(/closed/);
});

it('can retry a failed bind on the same instance after a port is released', async () => {
  const owner = makeListener();
  const address = await owner.listen(0);
  const contender = makeListener();
  await expect(contender.listen(Number(address.port))).rejects.toMatchObject({ code: 'EADDRINUSE' });
  expect(contender.draining).toBe(false);
  await owner.close();
  expect(await contender.listen(Number(address.port))).toEqual(address);
  expect(await (await fetch(address)).text()).toBe('ready');
});
