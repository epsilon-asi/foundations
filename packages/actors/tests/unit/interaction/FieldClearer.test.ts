import { describe, expect, it } from 'vitest';
import { clearField } from '../../../src/interaction/FieldClearer.js';
import { FakePage } from '../../fixtures/FakePage.js';

describe('clearField', () => {
  it('selects field contents and presses Backspace before typing', async () => {
    const page = new FakePage().setSelector('#email', { value: 'old@example.com' });

    await clearField(page, '#email');

    const state = page.selectors.get('#email');
    expect(state?.focused).toBe(true);
    expect(state?.selected).toBe(true);
    expect(page.keyboard.pressed).toEqual([{ key: 'Backspace' }]);
    expect(state?.value).toBe('');
    expect(state?.events).toEqual(expect.arrayContaining(['select', 'input', 'change']));
  });

  it('supports direct DOM clearing for callers that explicitly request it', async () => {
    const page = new FakePage().setSelector('#email', { value: 'old@example.com' });

    await clearField(page, '#email', { strategy: 'dom-value' });

    const state = page.selectors.get('#email');
    expect(page.keyboard.pressed).toEqual([]);
    expect(state?.value).toBe('');
    expect(state?.events).toEqual(expect.arrayContaining(['input', 'change']));
  });
});
