import { describe, expect, it } from 'vitest';
import { GhostCursorAdapter } from '../../../src/interaction/GhostCursorAdapter.js';
import { FakeGhostCursor } from '../../fixtures/FakeCursor.js';
import { FakePage } from '../../fixtures/FakePage.js';

describe('GhostCursorAdapter', () => {
  it('delegates clicks to ghost-cursor after waiting for the selector', async () => {
    const page = new FakePage().setSelector('#button');
    const cursor = new FakeGhostCursor();
    const adapter = new GhostCursorAdapter(page, { cursor });

    await adapter.click('#button', { cursorOptions: { waitForClick: 100 } });

    expect(page.waitedSelectors[0]?.selector).toBe('#button');
    expect(cursor.clicks).toEqual([{ selector: '#button', options: { waitForClick: 100 } }]);
  });

  it('delegates moves to ghost-cursor', async () => {
    const page = new FakePage().setSelector('#target');
    const cursor = new FakeGhostCursor();
    const adapter = new GhostCursorAdapter(page, { cursor });

    await adapter.move('#target', { cursorOptions: { moveSpeed: 700 } });

    expect(cursor.moves).toEqual([{ selector: '#target', options: { moveSpeed: 700 } }]);
  });

  it('types by clicking, selecting/deleting existing content, then sending keys one by one', async () => {
    const page = new FakePage().setSelector('#email', { value: 'old' });
    const cursor = new FakeGhostCursor();
    const sleeps: number[] = [];
    const adapter = new GhostCursorAdapter(page, {
      cursor,
      random: () => 0.5,
      sleep: async ms => { sleeps.push(ms); },
      typing: { intervalJitterMs: 0 }
    });

    await adapter.type('#email', 'new', { delayMs: 5 });

    expect(cursor.clicks.map(click => click.selector)).toContain('#email');
    expect(page.keyboard.pressed).toEqual([{ key: 'Backspace' }]);
    expect(page.keyboard.typed).toEqual([
      { text: 'n', options: { delay: 5 } },
      { text: 'e', options: { delay: 5 } },
      { text: 'w', options: { delay: 5 } }
    ]);
    expect(sleeps).toEqual([185, 185]);
  });

  it('can disable human typing and send the whole value at once', async () => {
    const page = new FakePage().setSelector('#email', { value: 'old' });
    const cursor = new FakeGhostCursor();
    const adapter = new GhostCursorAdapter(page, { cursor });

    await adapter.type('#email', 'new@example.com', { delayMs: 5, typing: { enabled: false } });

    expect(page.keyboard.typed).toEqual([{ text: 'new@example.com', options: { delay: 5 } }]);
  });

  it('scrolls an element into view', async () => {
    const page = new FakePage().setSelector('#item');
    const cursor = new FakeGhostCursor();
    const adapter = new GhostCursorAdapter(page, { cursor });

    await expect(adapter.scrollIntoView('#item')).resolves.toBeUndefined();
  });
});
