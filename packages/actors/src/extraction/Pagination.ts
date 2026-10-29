import type { HumanInteractor } from '../interaction/HumanInteractor.js';
import type { PageAdapter } from '../interaction/PageAdapter.js';

export interface CollectPagesOptions<T> {
  nextSelector: string;
  extractPage: () => Promise<T[]>;
  maxPages?: number;
  dedupeBy?: (item: T) => string;
  waitAfterNextMs?: number;
}

export class Pagination {
  constructor(
    private readonly page: PageAdapter,
    private readonly interactor: HumanInteractor
  ) {}

  async collectPages<T>(options: CollectPagesOptions<T>): Promise<T[]> {
    const allItems: T[] = [];
    const seen = new Set<string>();
    const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const pageItems = await options.extractPage();
      for (const item of pageItems) {
        const key = options.dedupeBy?.(item);
        if (key !== undefined) {
          if (seen.has(key)) continue;
          seen.add(key);
        }
        allItems.push(item);
      }

      if (pageNumber >= maxPages) break;

      const hasNext = await this.page.exists(options.nextSelector, { timeout: 500 });
      if (!hasNext) break;

      await this.interactor.click(options.nextSelector);
      if ((options.waitAfterNextMs ?? 0) > 0) {
        await new Promise(resolve => setTimeout(resolve, options.waitAfterNextMs));
      }
    }

    return allItems;
  }
}
