import { expect, it } from 'vitest';
import { assertOptionNamesAvailable } from '../../src/endpoints/assertOptionNamesAvailable.js';

it.each(['softDelete', 'versioned', 'deprecated', 'suspended', 'impersonation'])(
  'rejects the declared option %s regardless of its value',
  name => {
    for (const value of [true, false, undefined]) {
      expect(() => assertOptionNamesAvailable({ [name]: value }))
        .toThrow(`Declaration option "${name}" is reserved.`);
    }
  },
);

it('checks only exact option names at the current declaration level', () => {
  expect(() => assertOptionNamesAvailable({
    name: 'Offering',
    versionedAt: true,
    SoftDelete: true,
    fields: { suspended: 'boolean' },
  })).not.toThrow();
});

it('ignores inherited options', () => {
  expect(() => assertOptionNamesAvailable(Object.create({ deprecated: true }))).not.toThrow();
});
