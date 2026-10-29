import { SelectorError } from '../errors/SelectorError.js';
import type { HumanInteractor, HumanTypeOptions } from './HumanInteractor.js';
import type { PageAdapter } from './PageAdapter.js';

export interface FillTextOptions extends HumanTypeOptions {
  required?: boolean;
}

export class FormFiller {
  constructor(
    private readonly page: PageAdapter,
    private readonly interactor: HumanInteractor
  ) {}

  async fillText(selector: string, value: string, options: FillTextOptions = {}): Promise<void> {
    const exists = await this.page.exists(selector, { timeout: options.timeoutMs ?? 5_000 });
    if (!exists && (options.required ?? true)) {
      throw new SelectorError(`Required form field not found: ${selector}`, selector);
    }
    if (!exists) return;
    await this.interactor.type(selector, value, options);
  }

  async click(selector: string): Promise<void> {
    await this.interactor.click(selector);
  }
}
