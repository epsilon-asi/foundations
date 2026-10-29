import type {
  Browser,
  BrowserContext,
  ConnectOptions,
  HTTPResponse,
  LaunchOptions,
  Page,
  WaitForOptions,
  WaitForSelectorOptions
} from 'puppeteer-core';

export type PuppeteerLaunchOptions = LaunchOptions;
export type PuppeteerConnectOptions = ConnectOptions;

export interface PuppeteerLauncher {
  launch(options: PuppeteerLaunchOptions): Promise<BrowserLike>;
  connect?(options: PuppeteerConnectOptions): Promise<BrowserLike>;
}

export interface BrowserLike {
  defaultBrowserContext(): BrowserContextLike;
  pages(): Promise<PageLike[]>;
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
  disconnect?(): Promise<void> | void;
}

export interface BrowserContextLike {
  // Intentionally minimal; actors normally interact with PageLike.
}

export interface KeyboardLike {
  type(text: string, options?: { delay?: number }): Promise<void>;
  press(key: string, options?: { delay?: number }): Promise<void>;
}

export interface PageLike {
  keyboard: KeyboardLike;
  close(): Promise<void>;
  goto(url: string, options?: WaitForOptions): Promise<HTTPResponse | null>;
  waitForSelector(selector: string, options?: WaitForSelectorOptions): Promise<unknown>;
  waitForNavigation(options?: WaitForOptions): Promise<HTTPResponse | null>;
  click(selector: string, options?: Record<string, unknown>): Promise<void>;
  focus(selector: string): Promise<void>;
  $eval<T>(selector: string, pageFunction: (element: Element, ...args: unknown[]) => T, ...args: unknown[]): Promise<T>;
  $$eval<T>(selector: string, pageFunction: (elements: Element[], ...args: unknown[]) => T, ...args: unknown[]): Promise<T>;
  evaluate<T>(pageFunction: (...args: unknown[]) => T, ...args: unknown[]): Promise<T>;
  url(): string;
  title(): Promise<string>;
  content(): Promise<string>;
  screenshot(options?: Record<string, unknown>): Promise<Uint8Array | string>;
  setDefaultTimeout?(timeout: number): void;
  setDefaultNavigationTimeout?(timeout: number): void;
}

export function asBrowserLike(browser: Browser): BrowserLike {
  return browser as unknown as BrowserLike;
}

export function asBrowserContextLike(context: BrowserContext): BrowserContextLike {
  return context as unknown as BrowserContextLike;
}

export function asPageLike(page: Page): PageLike {
  return page as unknown as PageLike;
}
