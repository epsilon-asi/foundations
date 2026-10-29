import type { KeyboardLike } from '../browser/PuppeteerLike.js';
import { delay as defaultDelay } from '../utils/delay.js';

export type SleepFunction = (ms: number) => Promise<void>;
export type RandomFunction = () => number;

export interface HumanTypingOptions {
  /** Defaults to true. When false, the whole value is sent through keyboard.type. */
  enabled?: boolean;
  /** Target words per minute. Defaults to 65. */
  targetWordsPerMinute?: number;
  /** Standard typing-speed word length. Defaults to 5 characters. */
  averageWordLength?: number;
  /** Symmetric per-keystroke jitter around the target interval. Defaults to ±18 ms. */
  intervalJitterMs?: number;
  /** Minimum inter-key interval after jitter is applied. Defaults to 20 ms. */
  minimumIntervalMs?: number;
  /** Optional keydown-to-keyup hold delay passed to Puppeteer's keyboard.type per character. */
  keyHoldMs?: number;
}

export interface NormalizedHumanTypingOptions {
  enabled: boolean;
  targetWordsPerMinute: number;
  averageWordLength: number;
  intervalJitterMs: number;
  minimumIntervalMs: number;
  keyHoldMs: number;
}

export interface HumanTyperOptions {
  sleep?: SleepFunction;
  random?: RandomFunction;
  defaults?: HumanTypingOptions;
}

export const DEFAULT_HUMAN_TYPING_OPTIONS: NormalizedHumanTypingOptions = {
  enabled: true,
  targetWordsPerMinute: 65,
  averageWordLength: 5,
  intervalJitterMs: 18,
  minimumIntervalMs: 20,
  keyHoldMs: 0
};

export function characterIntervalMsForWordsPerMinute(
  targetWordsPerMinute: number,
  averageWordLength = DEFAULT_HUMAN_TYPING_OPTIONS.averageWordLength
): number {
  if (!Number.isFinite(targetWordsPerMinute) || targetWordsPerMinute <= 0) {
    throw new RangeError('targetWordsPerMinute must be greater than 0.');
  }
  if (!Number.isFinite(averageWordLength) || averageWordLength <= 0) {
    throw new RangeError('averageWordLength must be greater than 0.');
  }
  return 60_000 / (targetWordsPerMinute * averageWordLength);
}

export function normalizeHumanTypingOptions(options: HumanTypingOptions = {}): NormalizedHumanTypingOptions {
  const normalized = {
    enabled: options.enabled ?? DEFAULT_HUMAN_TYPING_OPTIONS.enabled,
    targetWordsPerMinute: options.targetWordsPerMinute ?? DEFAULT_HUMAN_TYPING_OPTIONS.targetWordsPerMinute,
    averageWordLength: options.averageWordLength ?? DEFAULT_HUMAN_TYPING_OPTIONS.averageWordLength,
    intervalJitterMs: options.intervalJitterMs ?? DEFAULT_HUMAN_TYPING_OPTIONS.intervalJitterMs,
    minimumIntervalMs: options.minimumIntervalMs ?? DEFAULT_HUMAN_TYPING_OPTIONS.minimumIntervalMs,
    keyHoldMs: options.keyHoldMs ?? DEFAULT_HUMAN_TYPING_OPTIONS.keyHoldMs
  } satisfies NormalizedHumanTypingOptions;

  if (!Number.isFinite(normalized.targetWordsPerMinute) || normalized.targetWordsPerMinute <= 0) {
    throw new RangeError('targetWordsPerMinute must be greater than 0.');
  }
  if (!Number.isFinite(normalized.averageWordLength) || normalized.averageWordLength <= 0) {
    throw new RangeError('averageWordLength must be greater than 0.');
  }
  if (!Number.isFinite(normalized.intervalJitterMs) || normalized.intervalJitterMs < 0) {
    throw new RangeError('intervalJitterMs must be greater than or equal to 0.');
  }
  if (!Number.isFinite(normalized.minimumIntervalMs) || normalized.minimumIntervalMs < 0) {
    throw new RangeError('minimumIntervalMs must be greater than or equal to 0.');
  }
  if (!Number.isFinite(normalized.keyHoldMs) || normalized.keyHoldMs < 0) {
    throw new RangeError('keyHoldMs must be greater than or equal to 0.');
  }

  return normalized;
}

export function mergeHumanTypingOptions(
  defaults: HumanTypingOptions | undefined,
  overrides: HumanTypingOptions | undefined
): HumanTypingOptions {
  return {
    ...(defaults ?? {}),
    ...(overrides ?? {})
  };
}

export function jitteredIntervalMs(
  baseIntervalMs: number,
  jitterMs: number,
  minimumIntervalMs: number,
  random: RandomFunction
): number {
  const normalizedRandom = Math.min(1, Math.max(0, random()));
  const jitter = (normalizedRandom * 2 - 1) * jitterMs;
  return Math.max(minimumIntervalMs, Math.round(baseIntervalMs + jitter));
}

function keyboardTypeOptions(delayMs: number): { delay: number } | undefined {
  return delayMs > 0 ? { delay: delayMs } : undefined;
}

export class HumanTyper {
  private readonly sleep: SleepFunction;
  private readonly random: RandomFunction;
  private readonly defaults: HumanTypingOptions | undefined;

  constructor(options: HumanTyperOptions = {}) {
    this.sleep = options.sleep ?? defaultDelay;
    this.random = options.random ?? Math.random;
    this.defaults = options.defaults;
  }

  async type(
    keyboard: KeyboardLike,
    text: string,
    options: HumanTypingOptions = {},
    legacyDelayMs?: number
  ): Promise<void> {
    const normalized = normalizeHumanTypingOptions(mergeHumanTypingOptions(this.defaults, options));
    const keyHoldMs = options.keyHoldMs ?? this.defaults?.keyHoldMs ?? legacyDelayMs ?? normalized.keyHoldMs;

    if (!normalized.enabled) {
      await keyboard.type(text, keyboardTypeOptions(keyHoldMs));
      return;
    }

    const baseIntervalMs = characterIntervalMsForWordsPerMinute(
      normalized.targetWordsPerMinute,
      normalized.averageWordLength
    );
    const characters = Array.from(text);

    for (let index = 0; index < characters.length; index += 1) {
      if (index > 0) {
        await this.sleep(jitteredIntervalMs(
          baseIntervalMs,
          normalized.intervalJitterMs,
          normalized.minimumIntervalMs,
          this.random
        ));
      }

      await keyboard.type(characters[index]!, keyboardTypeOptions(keyHoldMs));
    }
  }
}
