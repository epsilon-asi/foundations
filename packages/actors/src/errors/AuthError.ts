import { AutomationError, type AutomationErrorMeta } from './AutomationError.js';

export class AuthError extends AutomationError {
  constructor(message: string, meta: AutomationErrorMeta = {}) {
    super(message, meta);
  }
}
