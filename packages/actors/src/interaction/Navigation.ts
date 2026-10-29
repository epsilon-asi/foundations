import type { WaitForOptions } from 'puppeteer-core';
import type { HumanInteractor } from './HumanInteractor.js';
import type { PageAdapter } from './PageAdapter.js';
import { resolveUrl } from '../utils/url.js';

export interface ClickNavigationOptions {
  waitForNavigation?: boolean;
  navigationOptions?: WaitForOptions;
}

export class Navigator {
  constructor(
    private readonly page: PageAdapter,
    private readonly interactor: HumanInteractor,
    private readonly baseUrl: string
  ) {}

  resolve(urlOrPath: string): string {
    return resolveUrl(this.baseUrl, urlOrPath);
  }

  async goto(urlOrPath: string, options: WaitForOptions = { waitUntil: 'domcontentloaded' }): Promise<void> {
    await this.page.goto(this.resolve(urlOrPath), options);
  }

  async click(selector: string, options: ClickNavigationOptions = {}): Promise<void> {
    if (options.waitForNavigation) {
      await Promise.all([
        this.page.waitForNavigation(options.navigationOptions ?? { waitUntil: 'domcontentloaded' }),
        this.interactor.click(selector)
      ]);
      return;
    }

    await this.interactor.click(selector);
  }
}
