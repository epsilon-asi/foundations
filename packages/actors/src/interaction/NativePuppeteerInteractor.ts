import type { WaitForSelectorOptions } from 'puppeteer-core';
import type { PageLike } from '../browser/PuppeteerLike.js';
import { clearField } from './FieldClearer.js';
import type { HumanClickOptions, HumanInteractor, HumanMoveOptions, HumanTypeOptions } from './HumanInteractor.js';
import { HumanTyper, mergeHumanTypingOptions, type HumanTypingOptions, type RandomFunction, type SleepFunction } from './HumanTyping.js';

export interface NativePuppeteerInteractorOptions {
  typing?: HumanTypingOptions;
  typer?: HumanTyper;
  sleep?: SleepFunction;
  random?: RandomFunction;
}

function selectorWaitOptions(timeoutMs: number | undefined): WaitForSelectorOptions | undefined {
  return timeoutMs === undefined ? undefined : { timeout: timeoutMs };
}

export class NativePuppeteerInteractor implements HumanInteractor {
  private readonly typer: HumanTyper;
  private readonly typingDefaults: HumanTypingOptions | undefined;

  constructor(private readonly page: PageLike, options: NativePuppeteerInteractorOptions = {}) {
    this.typingDefaults = options.typing;
    this.typer = options.typer ?? new HumanTyper({
      ...(options.typing !== undefined ? { defaults: options.typing } : {}),
      ...(options.sleep !== undefined ? { sleep: options.sleep } : {}),
      ...(options.random !== undefined ? { random: options.random } : {})
    });
  }

  async click(selector: string, options: HumanClickOptions = {}): Promise<void> {
    if (options.waitForSelector !== false) {
      await this.page.waitForSelector(selector, selectorWaitOptions(options.timeoutMs));
    }
    await this.page.click(selector);
  }

  async move(selector: string, options: HumanMoveOptions = {}): Promise<void> {
    await this.page.waitForSelector(selector, selectorWaitOptions(options.timeoutMs));
  }

  async type(selector: string, value: string, options: HumanTypeOptions = {}): Promise<void> {
    await this.page.waitForSelector(selector, selectorWaitOptions(options.timeoutMs));

    if (options.clickBeforeTyping ?? true) {
      await this.page.click(selector);
    } else {
      await this.page.focus(selector);
    }

    if (options.clear ?? true) {
      await clearField(this.page, selector, options.clearMethod === undefined ? undefined : { strategy: options.clearMethod });
    }

    await this.typer.type(
      this.page.keyboard,
      value,
      mergeHumanTypingOptions(this.typingDefaults, options.typing),
      options.delayMs
    );
  }

  async scrollIntoView(selector: string): Promise<void> {
    await this.page.$eval(selector, element => {
      element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    });
  }
}
