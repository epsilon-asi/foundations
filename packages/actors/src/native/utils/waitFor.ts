import { delay } from '../../utils/delay.js';

export interface WaitForOptions {
  timeoutMs?: number;
  intervalMs?: number;
  description?: string;
}

export async function waitFor<T>(predicate: () => Promise<T | null | undefined | false>, options: WaitForOptions = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const intervalMs = options.intervalMs ?? 100;
  const startedAt = Date.now();
  let lastValue: T | null | undefined | false;

  do {
    lastValue = await predicate();
    if (lastValue !== null && lastValue !== undefined && lastValue !== false) {
      return lastValue;
    }
    await delay(intervalMs);
  } while (Date.now() - startedAt < timeoutMs);

  const description = options.description ?? 'condition';
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}.`);
}
