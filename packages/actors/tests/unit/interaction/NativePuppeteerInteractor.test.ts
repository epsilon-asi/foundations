import { describe, expect, it } from 'vitest';
import { NativePuppeteerInteractor } from '../../../src/interaction/NativePuppeteerInteractor.js';
import { FakePage } from '../../fixtures/FakePage.js';

describe('NativePuppeteerInteractor', () => {
  it('uses the same key-by-key typing and select-delete clear behavior without ghost-cursor', async () => {
    const page = new FakePage().setSelector('#field', { value: 'old' });
    const sleeps: number[] = [];
    const interactor = new NativePuppeteerInteractor(page, {
      random: () => 0.5,
      sleep: async ms => { sleeps.push(ms); },
      typing: { intervalJitterMs: 0 }
    });

    await interactor.type('#field', 'ok');

    expect(page.clicked).toEqual(['#field']);
    expect(page.keyboard.pressed).toEqual([{ key: 'Backspace' }]);
    expect(page.keyboard.typed.map(record => record.text)).toEqual(['o', 'k']);
    expect(sleeps).toEqual([185]);
  });
});
