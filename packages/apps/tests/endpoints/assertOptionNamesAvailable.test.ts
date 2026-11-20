import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, it } from 'vitest';
import { assertOptionNamesAvailable } from '../../src/endpoints/assertOptionNamesAvailable.js';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import type { Editable, Id } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';

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

it.each([
  ['Create', 'softDelete', false], ['Get', 'versioned', undefined], ['Update', 'deprecated', true],
  ['Delete', 'suspended', false], ['List', 'impersonation', undefined],
] as const)('checks the resource declaration and the options for %s', (operation, key, value) => {
  const reserved = { [key]: value };
  const error = new TypeError(`Declaration option "${key}" is reserved.`);
  const disabled = { Create: false, Get: false, Update: false, Delete: false, List: false };
  expect(() => crudRouteMetadata({ name: 'Offering', operations: disabled, ...reserved })).toThrow(error);
  expect(() => crudRouteMetadata({ name: 'Offering', operations: { [operation]: reserved } })).toThrow(error);
});

it('uses only own options of the resource, operations map and operation declaration', () => {
  const get = Object.assign(Object.create({ deprecated: true }), { docs: false });
  const operations = Object.assign(Object.create({ Delete: { versioned: false } }), { Get: get });
  const resource = Object.assign(Object.create({ softDelete: false }), { name: 'Offering', operations });
  const routes = crudRouteMetadata(resource);
  expect(routes.find(route => route.operation === 'Get')?.docs).toBe(false);
  expect(routes.find(route => route.operation === 'Delete')?.docs).toBe(true);
  Object.defineProperty(get, 'softDelete', { value: undefined });
  expect(() => crudRouteMetadata(resource)).toThrow('Declaration option "softDelete" is reserved.');
});

it('allows reserved words in model metadata, field names and field access rules', () => {
  const { Type, Prop, resolve } = createTypeRegistry().use(crudExtension);
  @Type({ meta: { versioned: true } })
  class Account {
    @Prop.uuid({ crud: 'id' }) key!: Id<string>;
    @Prop.boolean({ crud: 'editable', meta: { deprecated: false } }) suspended!: Editable<boolean>;
  }
  const routes = crudRouteMetadata({
    ...resolve(Account), access: { fields: { suspended: { write: 'OWNER' } } },
    list: { filter: { suspended: true } },
  });
  expect(routes.find(route => route.operation === 'List')?.Filters.suspended.path).toBe('suspended');
});
