import { describe, expect, it } from 'vitest';
import { redact } from '../../../src/utils/redact.js';

describe('redact', () => {
  it('redacts nested sensitive values without mutating the original object', () => {
    const input = {
      username: 'alice',
      password: 'secret',
      nested: {
        authorization: 'Bearer token',
        safe: 'value'
      },
      items: [
        { sessionCookie: 'abc123' },
        { name: 'visible' }
      ]
    };

    const output = redact(input);

    expect(output).toEqual({
      username: 'alice',
      password: '[REDACTED]',
      nested: {
        authorization: '[REDACTED]',
        safe: 'value'
      },
      items: [
        { sessionCookie: '[REDACTED]' },
        { name: 'visible' }
      ]
    });
    expect(input.password).toBe('secret');
    expect(input.nested.authorization).toBe('Bearer token');
  });
});
