import { describe, expect, it } from 'vitest';
import {
  characterIntervalMsForWordsPerMinute,
  HumanTyper,
  jitteredIntervalMs,
  normalizeHumanTypingOptions
} from '../../../src/interaction/HumanTyping.js';
import { FakeKeyboard } from '../../fixtures/FakePage.js';

describe('HumanTyper', () => {
  it('computes the 65 WPM cadence using five-character words', () => {
    expect(characterIntervalMsForWordsPerMinute(65, 5)).toBeCloseTo(184.615, 3);
  });

  it('types key-by-key and waits between characters at approximately 65 WPM', async () => {
    const keyboard = new FakeKeyboard();
    const sleeps: number[] = [];
    const typer = new HumanTyper({
      random: () => 0.5,
      sleep: async ms => { sleeps.push(ms); }
    });

    await typer.type(keyboard, 'abcd', { intervalJitterMs: 0 });

    expect(keyboard.typed.map(record => record.text)).toEqual(['a', 'b', 'c', 'd']);
    expect(sleeps).toEqual([185, 185, 185]);
  });

  it('applies small symmetric jitter to the inter-key interval', () => {
    const base = characterIntervalMsForWordsPerMinute(65, 5);

    expect(jitteredIntervalMs(base, 18, 20, () => 0)).toBe(167);
    expect(jitteredIntervalMs(base, 18, 20, () => 0.5)).toBe(185);
    expect(jitteredIntervalMs(base, 18, 20, () => 1)).toBe(203);
  });

  it('can fall back to bulk Puppeteer typing when human typing is disabled', async () => {
    const keyboard = new FakeKeyboard();
    const sleeps: number[] = [];
    const typer = new HumanTyper({
      sleep: async ms => { sleeps.push(ms); }
    });

    await typer.type(keyboard, 'hello', { enabled: false }, 7);

    expect(keyboard.typed).toEqual([{ text: 'hello', options: { delay: 7 } }]);
    expect(sleeps).toEqual([]);
  });

  it('validates typing configuration', () => {
    expect(() => normalizeHumanTypingOptions({ targetWordsPerMinute: 0 })).toThrow(RangeError);
    expect(() => normalizeHumanTypingOptions({ intervalJitterMs: -1 })).toThrow(RangeError);
  });
});
