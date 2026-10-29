import { delay } from './delay.js';

export interface RetryPolicy {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  jitter?: boolean;
}

export async function retry<T>(fn: () => Promise<T>, policy: RetryPolicy): Promise<T> {
  if (!Number.isInteger(policy.attempts) || policy.attempts < 1) {
    throw new Error('Retry attempts must be a positive integer.');
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= policy.attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === policy.attempts) break;

      const exponentialDelay = policy.baseDelayMs * 2 ** (attempt - 1);
      const cappedDelay = Math.min(exponentialDelay, policy.maxDelayMs ?? exponentialDelay);
      const jitter = policy.jitter ? Math.floor(Math.random() * Math.max(1, cappedDelay / 3)) : 0;
      await delay(cappedDelay + jitter);
    }
  }

  throw lastError;
}
