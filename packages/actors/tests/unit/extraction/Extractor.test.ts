import { describe, expect, it } from 'vitest';
import { Extractor } from '../../../src/extraction/Extractor.js';
import { PuppeteerPageAdapter } from '../../../src/interaction/PageAdapter.js';
import { FakePage } from '../../fixtures/FakePage.js';

describe('Extractor', () => {
  it('extracts single text and text lists', async () => {
    const fakePage = new FakePage()
      .setSelector('#title', { textContent: ' Title ' })
      .setTextList('.row', [' One ', 'Two', '   ']);
    const extractor = new Extractor(new PuppeteerPageAdapter(fakePage));

    await expect(extractor.text('#title')).resolves.toBe('Title');
    await expect(extractor.textList('.row')).resolves.toEqual(['One', 'Two']);
  });

  it('extracts attributes and href lists', async () => {
    const fakePage = new FakePage()
      .setSelector('#link', { attributes: { href: '/single' } });
    fakePage.selectorLists.set('a', [
      { attributes: { href: '/a' } },
      { attributes: { href: '/b' } },
      { attributes: {} }
    ]);
    const extractor = new Extractor(new PuppeteerPageAdapter(fakePage));

    await expect(extractor.attr('#link', 'href')).resolves.toBe('/single');
    await expect(extractor.hrefs('a')).resolves.toEqual(['/a', '/b']);
  });

  it('extracts table rows into objects', async () => {
    const fakePage = new FakePage().setSelector('table', {
      attributes: {
        __headers: 'Name|Amount',
        __rows: 'Alice|10\nBob|20'
      }
    });
    const extractor = new Extractor(new PuppeteerPageAdapter(fakePage));

    await expect(extractor.table('table')).resolves.toEqual({
      headers: ['Name', 'Amount'],
      rows: [
        { Name: 'Alice', Amount: '10' },
        { Name: 'Bob', Amount: '20' }
      ]
    });
  });
});
