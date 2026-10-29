import { AutomationError, type AutomationErrorMeta } from './AutomationError.js';

export class SelectorError extends AutomationError {
  readonly selector: string | undefined;

  constructor(message: string, selector?: string, meta: AutomationErrorMeta = {}) {
    super(message, meta);
    this.selector = selector;
  }
}
