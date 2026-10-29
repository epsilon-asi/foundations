import type { WaitForOptions, WaitForSelectorOptions } from 'puppeteer-core';
import { SelectorError } from '../errors/SelectorError.js';
import type { PageLike } from '../browser/PuppeteerLike.js';

export interface PageAdapter {
  goto(url: string, options?: WaitForOptions): Promise<void>;
  close(): Promise<void>;
  waitFor(selector: string, options?: WaitForSelectorOptions): Promise<void>;
  waitForNavigation(options?: WaitForOptions): Promise<void>;
  exists(selector: string, options?: WaitForSelectorOptions): Promise<boolean>;
  text(selector: string): Promise<string>;
  textAll(selector: string): Promise<string[]>;
  attr(selector: string, name: string): Promise<string | null>;
  html(): Promise<string>;
  url(): string;
  title(): Promise<string>;
  raw(): PageLike;
}

export class PuppeteerPageAdapter implements PageAdapter {
  constructor(private readonly page: PageLike) {}

  async close(): Promise<void> {
    await this.page.close();
  }
  async goto(url: string, options: WaitForOptions = { waitUntil: 'domcontentloaded' }): Promise<void> {
    await this.page.goto(url, options);
  }

  async waitFor(selector: string, options?: WaitForSelectorOptions): Promise<void> {
    await this.page.waitForSelector(selector, options);
  }

  async waitForNavigation(options?: WaitForOptions): Promise<void> {
    await this.page.waitForNavigation(options);
  }

  async exists(selector: string, options: WaitForSelectorOptions = { timeout: 1_000 }): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, options);
      return true;
    } catch {
      return false;
    }
  }

  async text(selector: string): Promise<string> {
    try {
      const value = await this.page.$eval(selector, element => element.textContent ?? '');
      return normalizeWhitespace(value);
    } catch (error) {
      throw new SelectorError(`Could not read text from selector: ${selector}`, selector, { cause: error });
    }
  }

  async textAll(selector: string): Promise<string[]> {
    const values = await this.page.$$eval(selector, elements =>
      elements.map(element => element.textContent ?? '')
    );
    return values.map(normalizeWhitespace).filter(value => value.length > 0);
  }

  async attr(selector: string, name: string): Promise<string | null> {
    try {
      return await this.page.$eval(selector, (element, attrName) => element.getAttribute(String(attrName)), name);
    } catch (error) {
      throw new SelectorError(`Could not read attribute ${name} from selector: ${selector}`, selector, { cause: error });
    }
  }

  async html(): Promise<string> {
    return this.page.content();
  }

  url(): string {
    return this.page.url();
  }

  title(): Promise<string> {
    return this.page.title();
  }

  raw(): PageLike {
    return this.page;
  }
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
