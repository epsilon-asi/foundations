import { ConfigError } from '../errors/ConfigError.js';

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new ConfigError(message);
  }
}
