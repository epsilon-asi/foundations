import { expect, it } from 'vitest';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import { member } from './member.fixture.js';

const metadata = { name: member.name, fields: member.fields };
const owner = { write: 'OWNER' };

it('accepts a field write rule for either enabled write operation, including inherited and write-only fields', () => {
  const fields = { role: owner, source: owner, revision: owner, password: owner };
  const routes = crudRouteMetadata({ ...member, access: { fields } });
  expect(routes.map(route => route.operation)).toEqual(['Create', 'Get', 'Update', 'Delete', 'List']);
});

it.each([
  ['Create', 'source', 'revision'],
  ['Update', 'revision', 'source'],
] as const)('checks the actual field grant when only %s accepts writes', (operation, granted, denied) => {
  const operations = { Create: false, Update: false, [operation]: true };
  const access = { fields: { [granted]: owner, password: owner } };
  expect(crudRouteMetadata({ ...member, operations, access }).map(route => route.operation)).toContain(operation);
  expect(() => crudRouteMetadata({ ...member, operations, access: { fields: { [denied]: owner } } }))
    .toThrow(new ApiDefinitionError(`Resource "Member" declares write access for field "${denied}", which no enabled Create or Update operation can write.`));
});

it.each(['key', 'organizationId', 'status', 'staffNote', 'token', 'providerId'])(
  'rejects a write rule for the non-writable field %s', name => {
    expect(() => crudRouteMetadata({ ...member, access: { fields: { [name]: owner } } })).toThrow(ApiDefinitionError);
  },
);

it('identifies the resource and undeclared field in the definition error', () => {
  expect(() => crudRouteMetadata({ ...metadata, access: { fields: { misspelled: owner } } }))
    .toThrow(new ApiDefinitionError('Resource "Member" declares write access for unknown field "misspelled".'));
});

it('requires an enabled create or update even when a shared resource has a general write rule and enables Delete', () => {
  const shared = { ...metadata, tenancy: 'shared', access: { read: 'VIEWER', write: 'EDITOR', fields: { role: owner } } } as const;
  expect(() => crudRouteMetadata(shared)).toThrow(/Member.*role/);
  expect(() => crudRouteMetadata({ ...shared, operations: { Delete: true } })).toThrow(/Member.*role/);
  expect(crudRouteMetadata({ ...shared, operations: { Create: true } }).map(route => route.operation))
    .toEqual(['Create', 'Get', 'List']);
});

it('checks only declared write rules and leaves name-only route previews available', () => {
  expect(crudRouteMetadata({ name: 'Preview', access: { fields: { unknown: owner } } })).toHaveLength(5);
  const fields = Object.assign(Object.create({ undeclared: owner }), {
    key: Object.create(owner), token: { write: undefined }, role: owner,
  });
  expect(crudRouteMetadata({ ...member, access: { fields } })).toHaveLength(5);
});
