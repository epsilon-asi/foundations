import { createJsonLogWriter, createLogger, type LogRecord } from '../../index.js';

describe('structured field redaction', () => {
  it('omits exact keys and hook matches from bound and per-call fields before a custom writer sees them', () => {
    const source = Object.freeze({ password: 'secret', clientToken: 'issued', Password: 'case-sensitive', count: 3 });
    const records: LogRecord[] = [];
    const logger = createLogger({
      write: record => records.push(record),
      redaction: { keys: ['password'], shouldRedact: key => key.endsWith('Token') },
    });

    logger.child({ requestId: 'r1', password: 'bound secret' }).info('saved', { results: [source] });

    expect(records).toEqual([{
      level: 'info',
      message: 'saved',
      fields: { requestId: 'r1', results: [{ Password: 'case-sensitive', count: 3 }] },
    }]);
    expect(source.password).toBe('secret');
    expect(source.clientToken).toBe('issued');
  });

  it('omits matching error properties without reading them and keeps record metadata intact', () => {
    const error = Object.defineProperty(new Error('retry'), 'token', {
      enumerable: true, get() { throw new Error('a redacted getter was evaluated'); },
    });
    const lines: string[] = [];
    const logger = createLogger({
      write: createJsonLogWriter({ write: line => lines.push(line) }),
      redaction: { keys: ['token', 'message', 'stack'] },
    });

    logger.warn('operation failed', { error, message: 'private detail', attempts: 2 });
    expect(JSON.parse(lines[0])).toEqual({
      level: 'warn', message: 'operation failed', error: { name: 'Error' }, attempts: 2,
    });
  });

  it('prevents custom JSON methods from reintroducing omitted fields and preserves the date value', () => {
    class Credentials {
      token = 'secret';
      user = 'Alice';
      toJSON() { return { exposed: this.token }; }
    }
    class CredentialList extends Array<Credentials> {
      toJSON() { return this.map(entry => entry.token); }
    }
    const date = Object.assign(new Date('2026-01-02T00:00:00Z'), { toJSON: () => 'secret' });
    const lines: string[] = [];
    const logger = createLogger({
      redaction: { keys: ['token'] },
      write: createJsonLogWriter({ write: line => lines.push(line) }),
    });

    logger.info('audit', { actors: new CredentialList(new Credentials()), date, invalid: new Date(NaN) });

    expect(JSON.parse(lines[0])).toEqual({
      level: 'info', message: 'audit', actors: [{ user: 'Alice' }], date: '2026-01-02T00:00:00.000Z', invalid: null,
    });
  });

  it('distinguishes shared values from cycles and handles ordinary fields named __proto__', () => {
    const shared = JSON.parse('{"__proto__":"ordinary field","token":"hidden"}');
    shared.self = shared;
    const lines: string[] = [];
    const logger = createLogger({
      redaction: { shouldRedact: key => key === 'token' },
      write: createJsonLogWriter({ write: line => lines.push(line) }),
    });

    logger.info('shared', { first: shared, second: shared });

    const expected = { ['__proto__']: 'ordinary field', self: '[Circular]' };
    expect(JSON.parse(lines[0])).toEqual({ level: 'info', message: 'shared', first: expected, second: expected });
    expect(shared.self).toBe(shared);
  });
});
