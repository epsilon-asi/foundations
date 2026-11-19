import { expect, it } from 'vitest';
import { Organization, Prop, registry, Resource, TenantResource, type Readable } from './resource.fixture.js';

it('inherits field schemas and CRUD options while keeping subclass fields local', () => {
  const base = registry.resolve(TenantResource);
  const organization = registry.resolve(Organization);
  expect([...base.fields.keys()]).toEqual(['status', 'privateCode']);
  expect([...organization.fields].map(([name, field]) => [name, field.extensions.crud])).toEqual([
    ['status', 'readable'], ['privateCode', undefined], ['name', 'editable'],
  ]);
  expect(organization.parse({ name: 'ACME', privateCode: 'xyz' })).toEqual({
    status: 'active', privateCode: 'xyz', name: 'ACME',
  });
  expect(organization.safeParse({ name: 'X', privateCode: 'xyz' }).success).toBe(false);
});

it('rejects an actual decorator override that exposes the inherited hidden field', () => {
  expect(() => {
    // @ts-expect-error Exercise the independent runtime check even if the caller bypasses typechecking.
    @Resource()
    class ExposedOrganization extends Organization {
      @Prop.string({ crud: 'readable' })
      override privateCode!: Readable<string>;
    }
  }).toThrow('ExposedOrganization.privateCode widens inherited access');
  expect(registry.resolve(TenantResource).fields.get('privateCode')?.extensions.crud).toBeUndefined();
});

it('keeps the original runtime permissions when a subclass only redeclares the field type', () => {
  class DeclarationOnly extends TenantResource {
    declare privateCode: Readable<string>;
  }
  const field = registry.resolve(DeclarationOnly).fields.get('privateCode');
  expect(field).toBeDefined();
  expect(field?.extensions.crud).toBeUndefined();
});
