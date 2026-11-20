import { createChainBinding, MiddlewareError } from '@epsilon-asi/foundation';
import type { AnyMiddleware, ChainResult } from './types.js';

export const commandChain = createChainBinding<AnyMiddleware, number, ChainResult>({
  subject: 'command',
  reservedKeys: ['instance', 'definition', 'options'],
  wrap: exitCode => ({ exitCode }),
  successful: exitCode => exitCode === 0,
  isStop(value, name): value is number {
    if (typeof value !== 'number') return false;
    if (!Number.isInteger(value) || value < 0) throw new MiddlewareError(name, `returned ${value}, which is not an exit code.`);
    return true;
  },
  invalidReturn: called => called
    ? 'must return what next() returned, or an exit code.'
    : 'neither called next() nor returned an exit code; return next() to continue or a number to stop.',
});
