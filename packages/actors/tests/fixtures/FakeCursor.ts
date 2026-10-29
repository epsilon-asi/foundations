import type { HumanClickOptions, HumanInteractor, HumanMoveOptions, HumanTypeOptions } from '../../src/interaction/HumanInteractor.js';

export class FakeHumanInteractor implements HumanInteractor {
  clicks: Array<{ selector: string; options?: HumanClickOptions }> = [];
  moves: Array<{ selector: string; options?: HumanMoveOptions }> = [];
  typed: Array<{ selector: string; value: string; options?: HumanTypeOptions }> = [];
  scrolled: string[] = [];

  async click(selector: string, options?: HumanClickOptions): Promise<void> {
    const record: { selector: string; options?: HumanClickOptions } = { selector };
    if (options !== undefined) record.options = options;
    this.clicks.push(record);
  }

  async move(selector: string, options?: HumanMoveOptions): Promise<void> {
    const record: { selector: string; options?: HumanMoveOptions } = { selector };
    if (options !== undefined) record.options = options;
    this.moves.push(record);
  }

  async type(selector: string, value: string, options?: HumanTypeOptions): Promise<void> {
    const record: { selector: string; value: string; options?: HumanTypeOptions } = { selector, value };
    if (options !== undefined) record.options = options;
    this.typed.push(record);
  }

  async scrollIntoView(selector: string): Promise<void> {
    this.scrolled.push(selector);
  }
}

export class FakeGhostCursor {
  clicks: Array<{ selector?: string; options?: Record<string, unknown> }> = [];
  moves: Array<{ selector: string; options?: Record<string, unknown> }> = [];

  async click(selector?: string, options?: Record<string, unknown>): Promise<void> {
    const record: { selector?: string; options?: Record<string, unknown> } = {};
    if (selector !== undefined) record.selector = selector;
    if (options !== undefined) record.options = options;
    this.clicks.push(record);
  }

  async move(selector: string, options?: Record<string, unknown>): Promise<void> {
    const record: { selector: string; options?: Record<string, unknown> } = { selector };
    if (options !== undefined) record.options = options;
    this.moves.push(record);
  }
}
