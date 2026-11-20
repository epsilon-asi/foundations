import { expectTypeOf } from 'vitest';
import { crudRouteMetadata, type CrudOperationMetadata, type CrudRouteMetadata, type CrudRouteMetadataOptions } from '../../src/endpoints/crudRouteMetadata.js';
import { enabledCrudOperations, type CrudOperation, type EnabledCrudOperation } from '../../src/endpoints/enabledCrudOperations.js';

const shared = crudRouteMetadata({ name: 'Report', tenancy: 'shared', access: { read: 'VIEWER' } });
expectTypeOf<(typeof shared)[number]['operation']>().toEqualTypeOf<'Get' | 'List'>();
expectTypeOf<(typeof shared)[number]['name']>().toEqualTypeOf<'GetReport' | 'ListReports'>();
expectTypeOf<(typeof shared)[number]['method']>().toEqualTypeOf<'get'>();
// @ts-expect-error A shared resource must explicitly enable Update.
shared.find(route => route.operation === 'Update');

const hiddenUpdate = crudRouteMetadata({
  name: 'Report', tenancy: 'shared', operations: { Get: false, Update: { docs: false } },
  access: { list: 'VIEWER', update: 'EDITOR' },
});
expectTypeOf<(typeof hiddenUpdate)[number]['operation']>().toEqualTypeOf<'Update' | 'List'>();
const update = hiddenUpdate.find(route => route.operation === 'Update')!;
expectTypeOf(update.name).toEqualTypeOf<'UpdateReport'>();
expectTypeOf(update.method).toEqualTypeOf<'patch'>();
expectTypeOf(update.Access).toEqualTypeOf<'EDITOR'>();

const empty = crudRouteMetadata({ name: 'Report', tenancy: 'shared', access: { read: 'VIEWER' }, operations: { Get: false, List: false } });
expectTypeOf(empty).toEqualTypeOf<never[]>();
expectTypeOf(enabledCrudOperations({ operations: { Create: false, Get: false, Update: false, Delete: false, List: false } })).toEqualTypeOf<never[]>();

interface SharedOptions {
  name: 'Report';
  tenancy: 'shared';
  operations?: { Get?: false; Create?: false; Update?: { scope: 'public' }; Delete: undefined };
  access: { read: 'VIEWER'; update: 'EDITOR' };
}
declare const saved: SharedOptions;
const possible = crudRouteMetadata(saved);
expectTypeOf<(typeof possible)[number]['operation']>().toEqualTypeOf<'Get' | 'List' | 'Update'>();
expectTypeOf<Extract<(typeof possible)[number], { operation: 'Update' }>['scope']>().toEqualTypeOf<'public'>();
expectTypeOf<CrudOperationMetadata<SharedOptions, 'Delete' | 'Create'>>().toBeNever();
expectTypeOf<EnabledCrudOperation<{ operations?: { Delete: false } }>>().toEqualTypeOf<CrudOperation>();
expectTypeOf<EnabledCrudOperation<{ tenancy?: 'shared' }>>().toEqualTypeOf<CrudOperation>();
expectTypeOf<CrudRouteMetadata<{ name: 'Report'; tenancy: 'shared' | 'account'; operations: { Delete: false } }>['operation']>()
  .toEqualTypeOf<Exclude<CrudOperation, 'Delete'>>();

declare const either:
  | { name: 'Report'; tenancy: 'shared'; operations: { Update: true }; access: { read: 'VIEWER'; update: 'EDITOR' } }
  | { name: 'Invoice'; scope: 'account'; operations: { Update: false; List: false } };
const routes = crudRouteMetadata(either);
type EitherRoute = (typeof routes)[number];
expectTypeOf<Extract<EitherRoute, { operation: 'Update' }>['name']>().toEqualTypeOf<'UpdateReport'>();
expectTypeOf<Extract<EitherRoute, { operation: 'Update' }>['Access']>().toEqualTypeOf<'EDITOR'>();
expectTypeOf<Extract<EitherRoute, { name: 'ListInvoices' }>>().toBeNever();
expectTypeOf<Extract<EitherRoute, { method: 'post' }>['name']>().toEqualTypeOf<'CreateInvoice'>();
expectTypeOf<Extract<EitherRoute, { method: 'get' }>['name']>().toEqualTypeOf<'GetReport' | 'GetInvoice' | 'ListReports'>();

// Index signatures permit absent overrides. An erased dictionary can also contain an explicit opt-in.
expectTypeOf<EnabledCrudOperation<{ tenancy: 'shared'; operations: Record<string, false> }>>().toEqualTypeOf<'Get' | 'List'>();
expectTypeOf<EnabledCrudOperation<{ operations: Record<string, false> }>>().toEqualTypeOf<CrudOperation>();
expectTypeOf<EnabledCrudOperation<{ tenancy: 'shared'; operations: Record<`U${string}`, true> }>>().toEqualTypeOf<'Get' | 'List' | 'Update'>();
expectTypeOf<EnabledCrudOperation<{ tenancy: 'shared'; operations: Record<string, unknown> }>>().toEqualTypeOf<CrudOperation>();

declare const widened: CrudRouteMetadataOptions;
expectTypeOf(enabledCrudOperations(widened)).toEqualTypeOf<CrudOperation[]>();
expectTypeOf<CrudRouteMetadata['operation']>().toEqualTypeOf<CrudOperation>();
function operationsFor<Options extends CrudRouteMetadataOptions>(options: Options): EnabledCrudOperation<Options>[] {
  return enabledCrudOperations(options);
}
expectTypeOf(operationsFor(saved)).toEqualTypeOf<('Get' | 'List' | 'Update')[]>();
