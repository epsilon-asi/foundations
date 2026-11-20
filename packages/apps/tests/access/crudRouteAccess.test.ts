import { expect, expectTypeOf, it } from 'vitest';
import type { CrudAccessMap } from '../../src/access/crudAccess.js';
import { assertUniqueRoutes } from '../../src/endpoints/assertUniqueRoutes.js';
import { crudRouteMetadata, type CrudRouteMetadata, type CrudRouteMetadataOptions } from '../../src/endpoints/crudRouteMetadata.js';
import { member } from './member.fixture.js';

function readAccess<Options extends CrudRouteMetadataOptions>(route: CrudRouteMetadata<Options>): string | object | undefined {
  assertUniqueRoutes([route]);
  return route.Access;
}

it('puts the declared read or write rule on each enabled operation and preserves its identity', () => {
  const read = { feature: 'directory' } as const;
  const write = [{ test: () => true, rule: 'OWNER' }, 'EDITOR'] as const;
  const routes = crudRouteMetadata({ name: 'DirectoryItem', access: { read, write, list: undefined } });
  for (const route of routes) {
    expect(readAccess(route)).toBe(route.Access);
    if (route.operation === 'Get' || route.operation === 'List') {
      expectTypeOf(route.Access).toEqualTypeOf<typeof read>();
      expect(route.Access).toBe(read);
    } else {
      expectTypeOf(route.Access).toEqualTypeOf<typeof write>();
      expect(route.Access).toBe(write);
    }
  }
});

it('prefers the specific rule for each operation, retaining literal types', () => {
  const routes = crudRouteMetadata({
    name: 'Project',
    access: { read: 'VIEWER', write: 'EDITOR', list: 'AUDITOR', create: 'AUTHOR', update: 'MANAGER', delete: 'OWNER' },
  });
  expect(routes.map(route => [route.operation, route.Access])).toEqual([
    ['Create', 'AUTHOR'], ['Get', 'VIEWER'], ['Update', 'MANAGER'], ['Delete', 'OWNER'], ['List', 'AUDITOR'],
  ]);
  type Route = (typeof routes)[number];
  expectTypeOf<Extract<Route, { operation: 'Create' }>['Access']>().toEqualTypeOf<'AUTHOR'>();
  expectTypeOf<Extract<Route, { operation: 'Delete' }>['Access']>().toEqualTypeOf<'OWNER'>();
  expectTypeOf<Extract<Route, { operation: 'List' }>['Access']>().toEqualTypeOf<'AUDITOR'>();
});

it('omits undeclared rules and keeps field write rules out of route access', () => {
  const routes = crudRouteMetadata({ ...member, operations: { Delete: false }, access: { fields: { role: { write: 'OWNER' } } } });
  expect(routes.map(route => route.operation)).toEqual(['Create', 'Get', 'Update', 'List']);
  expect(routes.every(route => !Object.hasOwn(route, 'Access'))).toBe(true);
  expectTypeOf<(typeof routes)[number]['Access']>().toEqualTypeOf<undefined>();
});

it('uses only the resource’s own access map and that map’s own declared rules', () => {
  const inherited = Object.assign(Object.create({ access: { read: 'OWNER', write: 'EDITOR' } }), { name: 'Project' });
  expect(crudRouteMetadata(inherited).every(route => !Object.hasOwn(route, 'Access'))).toBe(true);

  const access = Object.create({ read: 'INHERITED', update: 'INHERITED' });
  Object.defineProperty(access, 'write', { value: 'EDITOR' });
  const routes = crudRouteMetadata({ name: 'Project', access });
  expect(routes.filter(route => Object.hasOwn(route, 'Access')).map(route => [route.operation, route.Access]))
    .toEqual([['Create', 'EDITOR'], ['Update', 'EDITOR'], ['Delete', 'EDITOR']]);
});

it('types required fallbacks and optional or widened declarations according to their possible rules', () => {
  interface SavedAccess { read: 'VIEWER'; list?: 'AUDITOR'; write?: 'EDITOR' }
  const access: SavedAccess = { read: 'VIEWER' };
  const routes = crudRouteMetadata({ name: 'Project', access });
  const list = routes.find(route => route.operation === 'List')!;
  const create = routes.find(route => route.operation === 'Create')!;
  expectTypeOf<Pick<typeof list, 'Access'>>().toEqualTypeOf<{ Access: 'VIEWER' | 'AUDITOR' }>();
  expectTypeOf<Pick<typeof create, 'Access'>>().toEqualTypeOf<{ Access?: 'EDITOR' }>();
  expect(list.Access).toBe('VIEWER');
  expect(Object.hasOwn(create, 'Access')).toBe(false);

  function listWith(access?: SavedAccess) {
    return crudRouteMetadata({ name: 'Project', access }).find(route => route.operation === 'List')!;
  }
  expectTypeOf<Pick<ReturnType<typeof listWith>, 'Access'>>().toEqualTypeOf<{ Access?: 'VIEWER' | 'AUDITOR' }>();
  expect(Object.hasOwn(listWith(), 'Access')).toBe(false);
  const broad: CrudAccessMap = {};
  const widened = crudRouteMetadata({ name: 'Project', access: broad });
  expectTypeOf<(typeof widened)[number]['Access']>().toEqualTypeOf<string | object | undefined>();
  const indexed: Record<string, 'EDITOR'> = {};
  const fromIndex = crudRouteMetadata({ name: 'Project', access: indexed });
  expectTypeOf<(typeof fromIndex)[number]['Access']>().toEqualTypeOf<'EDITOR' | undefined>();
  expect(fromIndex.every(route => !Object.hasOwn(route, 'Access'))).toBe(true);
});
