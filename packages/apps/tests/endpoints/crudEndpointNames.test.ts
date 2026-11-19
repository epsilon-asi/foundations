import { expect, expectTypeOf, it } from 'vitest';
import { crudEndpointNames } from '../../src/endpoints/crudEndpointNames.js';

it('derives all five export names from the declared resource name', () => {
  const names = crudEndpointNames({ name: 'Offering' });
  const expected = {
    Create: 'CreateOffering', Get: 'GetOffering', Update: 'UpdateOffering',
    Delete: 'DeleteOffering', List: 'ListOfferings',
  } as const;
  expect(names).toEqual(expected);
  expectTypeOf(names).toEqualTypeOf<typeof expected>();
});

it('uses an explicit plural only for the list export', () => {
  const names = crudEndpointNames({ name: 'Company', plural: 'Companies' });
  const expected = {
    Create: 'CreateCompany', Get: 'GetCompany', Update: 'UpdateCompany',
    Delete: 'DeleteCompany', List: 'ListCompanies',
  } as const;
  expect(names).toEqual(expected);
  expectTypeOf(names).toEqualTypeOf<typeof expected>();
});

it('includes the default list name in the type when the override is optional', () => {
  function listName(options: { name: 'Person'; plural?: 'People' }) {
    return crudEndpointNames(options).List;
  }
  expectTypeOf(listName).returns.toEqualTypeOf<'ListPeople' | 'ListPersons'>();
  expect(listName({ name: 'Person' })).toBe('ListPersons');
  expect(listName({ name: 'Person', plural: 'People' })).toBe('ListPeople');
});
