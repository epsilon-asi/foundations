import type { HTTPResponse, WaitForOptions, WaitForSelectorOptions } from 'puppeteer-core';
import type { BrowserContextLike, BrowserLike, KeyboardLike, PageLike } from '../../src/browser/PuppeteerLike.js';

interface FakeElementState {
  textContent?: string;
  attributes?: Record<string, string>;
  value?: string;
  isContentEditable?: boolean;
  selected?: boolean;
  focused?: boolean;
  events?: string[];
  selectionStart?: number;
  selectionEnd?: number;
  scrolled?: boolean;
}

class FakeElement {
  private readonly attributes: Record<string, string>;

  constructor(private readonly state: FakeElementState = {}) {
    this.attributes = state.attributes ?? {};
    this.state.events ??= [];
  }

  get textContent(): string {
    return this.state.textContent ?? '';
  }

  set textContent(value: string) {
    this.state.textContent = value;
  }

  get value(): string {
    return this.state.value ?? '';
  }

  set value(value: string) {
    this.state.value = value;
  }

  get isContentEditable(): boolean {
    return this.state.isContentEditable ?? false;
  }

  get events(): string[] {
    return this.state.events ?? [];
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  dispatchEvent(event: Event): boolean {
    this.state.events ??= [];
    this.state.events.push(event.type);
    return true;
  }

  focus(): void {
    this.state.focused = true;
  }

  select(): void {
    this.state.selected = true;
    this.state.selectionStart = 0;
    this.state.selectionEnd = this.value.length;
  }

  setSelectionRange(start: number, end: number): void {
    this.state.selected = true;
    this.state.selectionStart = start;
    this.state.selectionEnd = end;
  }

  scrollIntoView(): void {
    this.state.scrolled = true;
  }

  querySelectorAll(selector: string): FakeElement[] {
    if (selector === 'thead th') {
      return this.attributes.__headers?.split('|').map(textContent => new FakeElement({ textContent })) ?? [];
    }
    if (selector === 'tbody tr') {
      const rowTexts = this.attributes.__rows?.split('\n').filter(Boolean) ?? [];
      return rowTexts.map(rowText => new FakeTableRow(rowText));
    }
    return [];
  }
}

class FakeTableRow extends FakeElement {
  constructor(private readonly rowText: string) {
    super();
  }

  override querySelectorAll(selector: string): FakeElement[] {
    if (selector !== 'td') return [];
    return this.rowText.split('|').map(textContent => new FakeElement({ textContent }));
  }
}

export class FakeKeyboard implements KeyboardLike {
  typed: Array<{ text: string; options?: { delay?: number } }> = [];
  pressed: Array<{ key: string; options?: { delay?: number } }> = [];

  async type(text: string, options?: { delay?: number }): Promise<void> {
    const record: { text: string; options?: { delay?: number } } = { text };
    if (options !== undefined) record.options = options;
    this.typed.push(record);
  }

  async press(key: string, options?: { delay?: number }): Promise<void> {
    const record: { key: string; options?: { delay?: number } } = { key };
    if (options !== undefined) record.options = options;
    this.pressed.push(record);
  }
}

export class FakePage implements PageLike {
  keyboard = new FakeKeyboard();
  readonly selectors = new Map<string, FakeElementState>();
  readonly selectorLists = new Map<string, FakeElementState[]>();
  readonly gotos: Array<{ url: string; options?: WaitForOptions }> = [];
  readonly waitedSelectors: Array<{ selector: string; options?: WaitForSelectorOptions }> = [];
  readonly waitedNavigations: WaitForOptions[] = [];
  readonly clicked: string[] = [];
  readonly focused: string[] = [];
  defaultTimeout?: number;
  defaultNavigationTimeout?: number;
  currentUrl = 'about:blank';
  pageTitle = 'Fake Page';
  pageContent = '<html></html>';
  screenshots: Record<string, unknown>[] = [];

  setSelector(selector: string, state: FakeElementState = {}): this {
    this.selectors.set(selector, state);
    return this;
  }

  setTextList(selector: string, texts: string[]): this {
    this.selectorLists.set(selector, texts.map(textContent => ({ textContent })));
    return this;
  }

  removeSelector(selector: string): this {
    this.selectors.delete(selector);
    return this;
  }

  async goto(url: string, options?: WaitForOptions): Promise<HTTPResponse | null> {
    this.currentUrl = url;
    const record: { url: string; options?: WaitForOptions } = { url };
    if (options !== undefined) record.options = options;
    this.gotos.push(record);
    return null;
  }

  async waitForSelector(selector: string, options?: WaitForSelectorOptions): Promise<unknown> {
    const record: { selector: string; options?: WaitForSelectorOptions } = { selector };
    if (options !== undefined) record.options = options;
    this.waitedSelectors.push(record);
    if (!this.selectors.has(selector) && !this.selectorLists.has(selector)) {
      throw new Error(`Missing selector: ${selector}`);
    }
    return {};
  }

  async waitForNavigation(options?: WaitForOptions): Promise<HTTPResponse | null> {
    this.waitedNavigations.push(options ?? {});
    return null;
  }

  async click(selector: string): Promise<void> {
    await this.waitForSelector(selector);
    this.clicked.push(selector);
  }

  async focus(selector: string): Promise<void> {
    await this.waitForSelector(selector);
    this.focused.push(selector);
  }

  async $eval<T>(selector: string, pageFunction: (element: Element, ...args: unknown[]) => T, ...args: unknown[]): Promise<T> {
    const state = this.selectors.get(selector);
    if (state === undefined) throw new Error(`Missing selector: ${selector}`);
    return pageFunction(new FakeElement(state) as unknown as Element, ...args);
  }

  async $$eval<T>(selector: string, pageFunction: (elements: Element[], ...args: unknown[]) => T, ...args: unknown[]): Promise<T> {
    const states = this.selectorLists.get(selector) ?? (this.selectors.has(selector) ? [this.selectors.get(selector)!] : []);
    const elements = states.map(state => new FakeElement(state) as unknown as Element);
    return pageFunction(elements, ...args);
  }

  async evaluate<T>(pageFunction: (...args: unknown[]) => T, ...args: unknown[]): Promise<T> {
    return pageFunction(...args);
  }

  url(): string {
    return this.currentUrl;
  }

  async title(): Promise<string> {
    return this.pageTitle;
  }

  async content(): Promise<string> {
    return this.pageContent;
  }

  async screenshot(options?: Record<string, unknown>): Promise<Uint8Array | string> {
    this.screenshots.push(options ?? {});
    return new Uint8Array();
  }

  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  setDefaultNavigationTimeout(timeout: number): void {
    this.defaultNavigationTimeout = timeout;
  }
}

export class FakeBrowserContext implements BrowserContextLike {}

export class FakeBrowser implements BrowserLike {
  readonly context = new FakeBrowserContext();
  readonly closeCalls: number[] = [];
  readonly disconnectCalls: number[] = [];
  defaultBrowserContextCalls = 0;
  newPageCalls = 0;
  createBrowserContextCalls = 0;

  constructor(private readonly pageList: FakePage[] = [new FakePage()]) {}

  defaultBrowserContext(): BrowserContextLike {
    this.defaultBrowserContextCalls += 1;
    return this.context;
  }

  async pages(): Promise<PageLike[]> {
    return this.pageList;
  }

  async newPage(): Promise<PageLike> {
    this.newPageCalls += 1;
    const page = new FakePage();
    this.pageList.push(page);
    return page;
  }

  // Deliberately not part of BrowserLike. Tests assert BrowserFactory never calls it.
  async createBrowserContext(): Promise<BrowserContextLike> {
    this.createBrowserContextCalls += 1;
    return new FakeBrowserContext();
  }

  async close(): Promise<void> {
    this.closeCalls.push(Date.now());
  }

  async disconnect(): Promise<void> {
    this.disconnectCalls.push(Date.now());
  }
}
