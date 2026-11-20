import { expect, it } from 'vitest';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import { endpointRouteContract } from '../../src/endpoints/endpointRouteContract.js';
import { transitionRouteMetadata } from '../../src/state/transitionRouteMetadata.js';

it('exposes the selected CRUD route and its resolved access rule by identity', () => {
  const read = { feature: 'catalog' } as const;
  const routes = crudRouteMetadata({ name: 'Person', plural: 'People', parent: { name: 'Catalog' }, access: { read, list: 'AUDITOR' } });
  const get = routes.find(route => route.operation === 'Get')!;
  const list = routes.find(route => route.operation === 'List')!;
  const endpoint = endpointRouteContract(get);
  expect(endpoint).toEqual({
    Name: 'GetPerson', Kind: 'crud', Method: 'get', Path: '/catalogs/:catalogId/people/:personId', Access: read, Route: get,
  });
  expect(endpoint.Route).toBe(get);
  expect(endpoint.Access).toBe(read);
  const listing = endpointRouteContract(list);
  expect(listing).toMatchObject({ Name: 'ListPeople', Path: '/catalogs/:catalogId/people', Access: 'AUDITOR' });
  expect(listing.Route.Filters).toBe(list.Filters);
});

it('includes Access on every contract and leaves an undeclared rule absent on the original route', () => {
  const archive = transitionRouteMetadata({ name: 'Offering', verb: 'archive', options: { archive: { scope: 'public', docs: false } } });
  const endpoint = endpointRouteContract(archive);
  expect(endpoint).toStrictEqual({
    Name: 'ArchiveOffering', Kind: 'transition', Method: 'post', Path: '/offerings/:offeringId/archive', Access: undefined, Route: archive,
  });
  expect(endpoint.Route).toBe(archive);
  const [create] = crudRouteMetadata({ name: 'Offering' });
  expect(Object.hasOwn(endpointRouteContract(create), 'Access')).toBe(true);
  expect(Object.hasOwn(create, 'Access')).toBe(false);
  expect(Object.hasOwn(archive, 'Access')).toBe(false);
});

it('ignores inherited access rules on a descriptor', () => {
  const route = transitionRouteMetadata({ name: 'Document', verb: 'sign' });
  const inherited = Object.assign(Object.create({ Access: 'OWNER' }), route) as typeof route;
  expect(endpointRouteContract(inherited).Access).toBeUndefined();
});

it('rejects an unsupported descriptor kind', () => {
  const transition = transitionRouteMetadata({ name: 'Document', verb: 'sign' });
  // @ts-expect-error This helper consumes the generated CRUD and transition descriptors.
  expect(() => endpointRouteContract({ ...transition, kind: 'action' })).toThrow('CRUD or transition route descriptor');
});
