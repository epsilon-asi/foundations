import { describe, expect, it } from 'vitest';
import { PuppeteerPageAdapter } from '../../../src/interaction/PageAdapter.js';
import { FakePage } from '../../fixtures/FakePage.js';

describe('PuppeteerPageAdapter', () => {
  it('normalizes text content', async () => {
    const fakePage = new FakePage().setSelector('#title', { textContent: '  Hello\n   World  ' });
    const page = new PuppeteerPageAdapter(fakePage);

    await expect(page.text('#title')).resolves.toBe('Hello World');
  });

  it('returns false when exists times out', async () => {
    const page = new PuppeteerPageAdapter(new FakePage());

    await expect(page.exists('#missing')).resolves.toBe(false);
  });

  it('reads attributes', async () => {
    const fakePage = new FakePage().setSelector('a', { attributes: { href: '/x' } });
    const page = new PuppeteerPageAdapter(fakePage);

    await expect(page.attr('a', 'href')).resolves.toBe('/x');
  });
});
