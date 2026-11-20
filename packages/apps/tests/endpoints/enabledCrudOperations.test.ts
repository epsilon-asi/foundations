import { expect, expectTypeOf, it } from 'vitest';
import { enabledCrudOperations } from '../../src/endpoints/enabledCrudOperations.js';

const allOperations = ['Create', 'Get', 'Update', 'Delete', 'List'] as const;

it('enables all five operations when the resource is not shared', () => {
  expect(enabledCrudOperations()).toEqual(allOperations);
  expectTypeOf(enabledCrudOperations()).toEqualTypeOf<(typeof allOperations)[number][]>();
  for (const tenancy of ['owned', 'self', 'account'] as const) {
    expect(enabledCrudOperations({ tenancy })).toEqual(allOperations);
  }
});

it('enables only Get and List by default on shared resources', () => {
  const operations = enabledCrudOperations({ tenancy: 'shared' });
  expect(operations).toEqual(['Get', 'List']);
  expectTypeOf(operations).toEqualTypeOf<('Get' | 'List')[]>();
});

it('applies boolean and per-operation options in canonical order', () => {
  interface UserOnlySettings { principals: readonly ['user'] }
  const userOnly: UserOnlySettings = { principals: ['user'] };
  const shared = enabledCrudOperations({
    tenancy: 'shared',
    operations: { List: false, Delete: userOnly, Update: true },
  });
  expect(shared).toEqual(['Get', 'Update', 'Delete']);
  expectTypeOf(shared).toEqualTypeOf<('Get' | 'Update' | 'Delete')[]>();

  const ordinary = enabledCrudOperations({ operations: { Delete: false } });
  expect(ordinary).toEqual(['Create', 'Get', 'Update', 'List']);
  expectTypeOf(ordinary).toEqualTypeOf<('Create' | 'Get' | 'Update' | 'List')[]>();
});

it('requires explicit shared writes even when the operations object inherits a declaration', () => {
  const operations = Object.assign(Object.create({ Delete: true }), { Update: undefined });
  expect(enabledCrudOperations({ tenancy: 'shared', operations })).toEqual(['Get', 'List']);
});

it('rejects a malformed operation override before it can enable a shared write', () => {
  for (const malformed of [[], new Date(), null]) {
    // @ts-expect-error An operation takes a boolean or a settings object.
    expect(() => enabledCrudOperations({ tenancy: 'shared', operations: { Create: malformed } }))
      .toThrow('CRUD operation "Create" requires a boolean or an options object.');
  }
});
