import { expect, expectTypeOf, it } from 'vitest';
import { CRUD_OPERATIONS } from '../../src/endpoints/crudOperations.js';

it('assigns each CRUD operation its HTTP method and success code', () => {
  const expected = {
    Create: { method: 'post', code: 201 },
    Get: { method: 'get', code: 200 },
    Update: { method: 'patch', code: 200 },
    Delete: { method: 'delete', code: 200 },
    List: { method: 'get', code: 200 },
  } as const;
  expect(CRUD_OPERATIONS).toEqual(expected);
  expectTypeOf(CRUD_OPERATIONS).toEqualTypeOf<typeof expected>();
});

it('freezes both the shared table and each operation', () => {
  expect(Object.isFrozen(CRUD_OPERATIONS)).toBe(true);
  for (const operation of Object.values(CRUD_OPERATIONS)) {
    expect(Object.isFrozen(operation)).toBe(true);
  }
});
