import { runInNewContext } from 'node:vm';
import { createJsonLogWriter, createLogger, type LogRecord } from '../../index.js';

describe('structured Error fields', () => {
  it('gives custom writers a snapshot of the error, its cause and enumerable metadata', () => {
    const cause = new RangeError('out of bounds');
    const error = Object.assign(new TypeError('read failed', { cause }), { code: 'READ_FAILED' });
    const records: LogRecord[] = [];
    const logger = createLogger({ write: record => records.push(record) });

    logger.error('request failed', { detail: error });
    error.code = 'CHANGED';
    cause.message = 'changed';

    expect(records[0].fields?.detail).toEqual({
      name: 'TypeError', message: 'read failed', stack: error.stack, code: 'READ_FAILED',
      cause: { name: 'RangeError', message: 'out of bounds', stack: expect.any(String) },
    });
  });

  it('serializes nested errors in standalone JSON records and preserves ordinary JSON values', () => {
    const lines: string[] = [];
    const write = createJsonLogWriter({ write: line => lines.push(line) });
    const date = new Date('2026-01-02T00:00:00Z');
    const error = Object.assign(new SyntaxError('bad input'), { toJSON: () => 'hidden error' });
    const errors = new AggregateError([error], 'checks failed');
    write({ level: 'error', message: 'validation', fields: {
      checks: [errors], date, extra: { toJSON: () => 'custom value' },
    } });

    expect(JSON.parse(lines[0])).toEqual({
      level: 'error', message: 'validation', date: date.toISOString(), extra: 'custom value',
      checks: [{ name: 'AggregateError', message: 'checks failed', stack: errors.stack, errors: [
        { name: 'SyntaxError', message: 'bad input', stack: error.stack },
      ] }],
    });
  });

  it('recognizes an error originating in another realm', () => {
    const error: unknown = runInNewContext('new ReferenceError("missing binding")');
    const lines: string[] = [];
    const write = createJsonLogWriter({ write: line => lines.push(line) });
    write({ level: 'error', message: 'load failed', fields: { error } });
    expect(JSON.parse(lines[0]).error).toMatchObject({ name: 'ReferenceError', message: 'missing binding' });
  });

  it.each(['logger', 'writer'])('captures each getter once through the %s', mode => {
    const lines: string[] = [];
    const write = createJsonLogWriter({ write: line => lines.push(line) });
    let reads = 0;
    const fields = {
      details: {
        get status() {
          reads++;
          Object.defineProperty(this, 'status', { value: 'already read' });
          return 'ready';
        },
      },
    };
    if (mode === 'logger') createLogger({ write }).info('status', fields);
    else write({ level: 'info', message: 'status', fields });

    expect(reads).toBe(1);
    expect(JSON.parse(lines[0]).details).toEqual({ status: 'ready' });
  });
});
