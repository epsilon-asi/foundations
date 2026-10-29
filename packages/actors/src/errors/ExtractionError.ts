import { AutomationError, type AutomationErrorMeta } from './AutomationError.js';

export class ExtractionError extends AutomationError {
  constructor(message: string, meta: AutomationErrorMeta = {}) {
    super(message, meta);
  }
}
