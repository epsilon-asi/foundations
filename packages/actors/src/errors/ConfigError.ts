import { AutomationError, type AutomationErrorMeta } from './AutomationError.js';

export class ConfigError extends AutomationError {
  constructor(message: string, meta: AutomationErrorMeta = {}) {
    super(message, meta);
  }
}
