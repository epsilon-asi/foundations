import { describe, expect, it } from 'vitest';
import { Pagination } from '../../../src/extraction/Pagination.js';
import { PuppeteerPageAdapter } from '../../../src/interaction/PageAdapter.js';
import { FakeHumanInteractor } from '../../fixtures/FakeCursor.js';
import { FakePage } from '../../fixtures/FakePage.js';

describe('Pagination', () => {
  it('collects pages until the next selector is missing', async () => {
    const fakePage = new FakePage().setSelector('#next');
    const interactor = new FakeHumanInteractor();
    const pagination = new Pagination(new PuppeteerPageAdapter(fakePage), interactor);
    let pageNumber = 0;

    const result = await pagination.collectPages({
      nextSelector: '#next',
      extractPage: async () => {
        pageNumber += 1;
        if (pageNumber === 2) fakePage.removeSelector('#next');
        return [`page-${pageNumber}`];
      }
    });

    expect(result).toEqual(['page-1', 'page-2']);
    expect(interactor.clicks.map(click => click.selector)).toEqual(['#next']);
  });

  it('respects maxPages', async () => {
    const fakePage = new FakePage().setSelector('#next');
    const interactor = new FakeHumanInteractor();
    const pagination = new Pagination(new PuppeteerPageAdapter(fakePage), interactor);

    const result = await pagination.collectPages({
      nextSelector: '#next',
      maxPages: 2,
      extractPage: async () => ['item']
    });

    expect(result).toEqual(['item', 'item']);
    expect(interactor.clicks).toHaveLength(1);
  });

  it('deduplicates collected items when configured', async () => {
    const fakePage = new FakePage();
    const pagination = new Pagination(new PuppeteerPageAdapter(fakePage), new FakeHumanInteractor());

    const result = await pagination.collectPages({
      nextSelector: '#next',
      extractPage: async () => [{ id: '1' }, { id: '1' }],
      dedupeBy: item => item.id
    });

    expect(result).toEqual([{ id: '1' }]);
  });
});
