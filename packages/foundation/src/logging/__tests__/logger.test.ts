import { createLogger, type LogRecord } from '../../index.js';

describe('createLogger', () => {
  it('writes messages and optional fields at the default info threshold', () => {
    const records: LogRecord[] = [];
    const logger = createLogger({ write: record => records.push(record) });

    logger.debug('filtered', { attempt: 1 });
    logger.info('started');
    logger.warn('retry', { attempt: 2 });
    logger.error('failed');

    expect(logger.level).toBe('info');
    expect(records).toStrictEqual([
      { level: 'info', message: 'started' },
      { level: 'warn', message: 'retry', fields: { attempt: 2 } },
      { level: 'error', message: 'failed' },
    ]);
  });

  it('keeps thresholds independent for loggers sharing a writer', () => {
    const records: LogRecord[] = [];
    const write = (record: LogRecord) => records.push(record);
    const verbose = createLogger({ level: 'debug', write });
    const silent = createLogger({ level: 'silent', write });

    verbose.debug('visible');
    silent.error('filtered');

    expect(records).toStrictEqual([{ level: 'debug', message: 'visible' }]);
  });

  it('keeps child and sibling bindings independent and uses the parent threshold and writer', () => {
    const records: LogRecord[] = [];
    const root = createLogger({ level: 'warn', write: record => records.push(record) });
    const bindings = { requestId: 'first' };
    const first = root.child(bindings);
    bindings.requestId = 'second';
    const second = root.child(bindings);

    first.info('filtered');
    first.warn('one');
    second.error('two');
    root.warn('root');

    expect(first.level).toBe('warn');
    expect(records).toEqual([
      { level: 'warn', message: 'one', fields: { requestId: 'first' } },
      { level: 'error', message: 'two', fields: { requestId: 'second' } },
      { level: 'warn', message: 'root' },
    ]);
  });

  it('lets nested children and individual calls override the nearest bindings', () => {
    const records: LogRecord[] = [];
    const logger = createLogger({ write: record => records.push(record) });
    const parent = logger.child({ scope: 'root', requestId: 'abc' });
    const child = parent.child({ scope: 'child' });

    child.info('one', { scope: 'call' });
    child.info('two');
    parent.info('three');

    expect(records.map(record => record.fields)).toEqual([
      { scope: 'call', requestId: 'abc' },
      { scope: 'child', requestId: 'abc' },
      { scope: 'root', requestId: 'abc' },
    ]);
  });

  it('merges only own enumerable fields and skips redacted getters before reading them', () => {
    const records: LogRecord[] = [];
    const logger = createLogger({ redaction: { keys: ['secret'] }, write: record => records.push(record) });
    const sensitive = { get secret(): string { throw new Error('should never read'); } };
    const bindings = Object.create({ inherited: 'skip' }, Object.getOwnPropertyDescriptors(sensitive));
    Object.defineProperty(bindings, 'requestId', { value: 'abc' });
    Object.defineProperty(bindings, 'publicId', { enumerable: true, get() { return this.requestId; } });
    const child = logger.child(bindings);
    const callFields = JSON.parse('{"__proto__":"own value"}');

    child.info('bound getter', callFields);
    child.info('per-call getter', sensitive);

    expect(records.map(record => record.fields)).toEqual([
      JSON.parse('{"publicId":"abc","__proto__":"own value"}'),
      { publicId: 'abc' },
    ]);
  });
});
