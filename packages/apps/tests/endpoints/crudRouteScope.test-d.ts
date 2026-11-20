import { expectTypeOf } from 'vitest';
import { crudRouteMetadata, type CrudOperationMetadata, type CrudRouteMetadata, type CrudRouteMetadataOptions } from '../../src/endpoints/crudRouteMetadata.js';
import { defaultFailureCodes } from '../../src/endpoints/defaultFailureCodes.js';
import type { EndpointScope } from '../../src/tenancy/endpointScope.js';

const accountRoutes = crudRouteMetadata({
  name: 'Report', tenancy: 'account', operations: { List: { scope: 'public' }, Get: true },
});
const list = accountRoutes.find(route => route.operation === 'List')!;
const get = accountRoutes.find(route => route.operation === 'Get')!;
expectTypeOf(list.scope).toEqualTypeOf<'public'>();
expectTypeOf(get.scope).toEqualTypeOf<'account'>();
expectTypeOf(defaultFailureCodes(list)).toEqualTypeOf<(422 | 429 | 500)[]>();

declare const branch:
  | { name: 'Report'; scope: 'tenant'; operations: { List: { scope: 'public' } }; access: { read: 'VIEWER' } }
  | { name: 'Invoice'; tenancy: 'account'; access: { read: 'OWNER' } };
const routes = crudRouteMetadata(branch);
type List = Extract<(typeof routes)[number], { operation: 'List' }>;
type Reads = CrudOperationMetadata<typeof branch, 'Get' | 'List'>;
expectTypeOf<Extract<Reads, { operation: 'List' }>>().toEqualTypeOf<List>();
expectTypeOf<List['scope']>().toEqualTypeOf<'public' | 'account'>();
expectTypeOf<Extract<List, { name: 'ListReports' }>['scope']>().toEqualTypeOf<'public'>();
expectTypeOf<Extract<List, { scope: 'account' }>['Access']>().toEqualTypeOf<'OWNER'>();
expectTypeOf<Extract<(typeof routes)[number], { operation: 'Get' }>['scope']>().toEqualTypeOf<'tenant' | 'account'>();

interface SavedOptions {
  name: 'Project';
  tenancy: 'account';
  scope?: 'tenant';
  operations?: { List: { scope?: 'public' } | true };
}
declare const saved: SavedOptions;
const savedRoutes = crudRouteMetadata(saved);
expectTypeOf<Extract<(typeof savedRoutes)[number], { operation: 'Get' }>['scope']>().toEqualTypeOf<'account' | 'tenant'>();
expectTypeOf<Extract<(typeof savedRoutes)[number], { operation: 'List' }>['scope']>().toEqualTypeOf<EndpointScope>();

declare const tenancy: 'account' | 'owned' | undefined;
const defaults = crudRouteMetadata({ name: 'Project', tenancy, scope: undefined, operations: { Get: { scope: undefined } } });
expectTypeOf<(typeof defaults)[number]['scope']>().toEqualTypeOf<'account' | 'tenant'>();

declare const indexed: Record<string, { scope: 'public' }> & { List: { scope: 'public' } };
const indexedRoutes = crudRouteMetadata({ name: 'Report', scope: 'account', operations: indexed });
expectTypeOf<Extract<(typeof indexedRoutes)[number], { operation: 'Get' }>['scope']>().toEqualTypeOf<'account' | 'public'>();
expectTypeOf<Extract<(typeof indexedRoutes)[number], { operation: 'List' }>['scope']>().toEqualTypeOf<'public'>();

declare const disabledOrPublic: false | { scope: 'public' };
const sometimesListed = crudRouteMetadata({ name: 'Report', operations: { List: disabledOrPublic } });
expectTypeOf<Extract<(typeof sometimesListed)[number], { operation: 'List' }>['scope']>().toEqualTypeOf<'public'>();

declare const templateIndex: Record<`G${string}`, { scope: 'public' }>;
const byPrefix = crudRouteMetadata({ name: 'Report', tenancy: 'account', operations: templateIndex });
expectTypeOf<Extract<(typeof byPrefix)[number], { operation: 'Get' }>['scope']>().toEqualTypeOf<'account' | 'public'>();
expectTypeOf<Extract<(typeof byPrefix)[number], { operation: 'List' }>['scope']>().toEqualTypeOf<'account'>();

declare const erased: Record<string, unknown>;
const erasedRoutes = crudRouteMetadata({ name: 'Report', tenancy: 'account', operations: erased });
expectTypeOf<(typeof erasedRoutes)[number]['scope']>().toEqualTypeOf<EndpointScope>();

declare const widenedOperations: CrudRouteMetadataOptions['operations'];
const widened = crudRouteMetadata({ name: 'Record', tenancy: 'account', operations: widenedOperations });
expectTypeOf<(typeof widened)[number]['scope']>().toEqualTypeOf<EndpointScope>();
expectTypeOf<CrudRouteMetadata['scope']>().toEqualTypeOf<EndpointScope>();
function scopeOf<Options extends CrudRouteMetadataOptions>(route: CrudRouteMetadata<Options>): EndpointScope {
  return route.scope;
}
