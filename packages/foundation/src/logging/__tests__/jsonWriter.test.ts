import { createJsonLogWriter, createLogger } from '../../index.js';

describe('createJsonLogWriter', () => {
  it.each([
    [undefined, { level: 'warn' }],
    ['generic', { level: 'warn' }],
    ['gcp', { severity: 'WARNING' }],
  ] as const)('writes a structured record in %s format as one JSON line', (format, severity) => {
    const lines: string[] = [];
    const write = (line: string) => lines.push(line);
    const logger = createLogger({ write: createJsonLogWriter({ write, format }) });
    const fields = { requestId: 'r-123', details: { retries: 2, tags: ['retry'] } };

    logger.warn('retry\nrequested', fields);

    expect(lines).toHaveLength(1);
    const parts = lines[0].split('\n');
    expect(parts).toHaveLength(2);
    expect(parts[1]).toBe('');
    expect(JSON.parse(parts[0])).toEqual({ ...severity, message: 'retry\nrequested', ...fields });
  });

  it('maps every emitted level to a Cloud Logging severity', () => {
    const entries: unknown[] = [];
    const write = createJsonLogWriter({ format: 'gcp', write: line => entries.push(JSON.parse(line)) });
    for (const level of ['debug', 'info', 'warn', 'error'] as const) write({ level, message: 'test' });

    expect(entries).toEqual(['DEBUG', 'INFO', 'WARNING', 'ERROR'].map(severity => ({ severity, message: 'test' })));
  });

  it.each([
    ['generic', 'level', 'info'],
    ['gcp', 'severity', 'INFO'],
  ] as const)('preserves the %s envelope when field names collide', (format, key, expected) => {
    const lines: string[] = [];
    const write = createJsonLogWriter({ format, write: line => lines.push(line) });
    const fields = Object.freeze({ [key]: 'other', message: 'other', toJSON: () => undefined });

    write({ level: 'info', message: 'saved', fields });

    expect(JSON.parse(lines[0])).toEqual({ [key]: expected, message: 'saved' });
  });
});
