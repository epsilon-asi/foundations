import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../src/logger.js';

describe('createLogger', () => {
  it('writes messages at or above the minimum level', () => {
    const write = vi.fn<(text: string) => void>();
    const logger = createLogger('warn', write);

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(write.mock.calls).toEqual([['[warn] w\n'], ['[error] e\n']]);
  });

  it('writes every level when the minimum is debug', () => {
    const write = vi.fn<(text: string) => void>();
    const logger = createLogger('debug', write);

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(write).toHaveBeenCalledTimes(4);
  });
});
