import { DEFAULT_LOG_LEVEL, LOG_LEVELS, isLogLevel } from '../../index.js';

describe('log levels', () => {
  it('orders the thresholds from debug to silent and defaults to info', () => {
    expect(LOG_LEVELS).toEqual(['debug', 'info', 'warn', 'error', 'silent']);
    expect(DEFAULT_LOG_LEVEL).toBe('info');
  });

  it('accepts each declared level and rejects other inputs', () => {
    for (const level of LOG_LEVELS) expect(isLogLevel(level)).toBe(true);
    for (const value of ['INFO', 'trace', '', undefined, null, 0]) expect(isLogLevel(value)).toBe(false);
  });
});
