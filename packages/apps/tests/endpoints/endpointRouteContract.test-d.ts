import { expectTypeOf } from 'vitest';
import {
  crudRouteMetadata, endpointRouteContract, transitionRouteMetadata,
  type CrudRouteMetadata, type CrudRouteMetadataOptions, type EndpointRouteContract, type EndpointRouteDescriptor,
} from '../../src/index.js';

const routes = crudRouteMetadata({ name: 'Person', plural: 'People', access: { list: { feature: 'catalog' }, write: 'EDITOR' } });
const list = routes.find(route => route.operation === 'List')!;
const update = routes.find(route => route.operation === 'Update')!;
const listEndpoint = endpointRouteContract(list);
expectTypeOf(listEndpoint.Name).toEqualTypeOf<'ListPeople'>();
expectTypeOf(listEndpoint.Kind).toEqualTypeOf<'crud'>();
expectTypeOf(listEndpoint.Method).toEqualTypeOf<'get'>();
expectTypeOf(listEndpoint.Path).toEqualTypeOf<typeof list.path>();
expectTypeOf(listEndpoint.Access).toEqualTypeOf<{ readonly feature: 'catalog' }>();
expectTypeOf(listEndpoint.Route).toEqualTypeOf<typeof list>();
expectTypeOf<keyof typeof listEndpoint>().toEqualTypeOf<'Name' | 'Kind' | 'Method' | 'Path' | 'Access' | 'Route'>();

const archive = transitionRouteMetadata({ name: 'Person', verb: 'archive' });
const archiveEndpoint = endpointRouteContract(archive);
expectTypeOf(archiveEndpoint.Name).toEqualTypeOf<typeof archive.name>();
expectTypeOf(archiveEndpoint.Method).toEqualTypeOf<'post'>();
expectTypeOf(archiveEndpoint.Access).toBeUndefined();
expectTypeOf(archiveEndpoint.Route).toEqualTypeOf<typeof archive>();

declare const selected: typeof update | typeof list | typeof archive;
const endpoint = endpointRouteContract(selected);
if (endpoint.Kind === 'transition') {
  expectTypeOf(endpoint.Route).toEqualTypeOf<typeof archive>();
} else if (endpoint.Name === 'UpdatePerson') {
  expectTypeOf(endpoint.Method).toEqualTypeOf<'patch'>();
  expectTypeOf(endpoint.Access).toEqualTypeOf<'EDITOR'>();
  expectTypeOf(endpoint.Route).toEqualTypeOf<typeof update>();
} else {
  expectTypeOf(endpoint.Access).toEqualTypeOf<typeof list.Access>();
  expectTypeOf(endpoint.Route).toEqualTypeOf<typeof list>();
}

declare const access: { read?: 'VIEWER' } | undefined;
const optional = crudRouteMetadata({ name: 'Plan', access }).find(route => route.operation === 'Get')!;
expectTypeOf(endpointRouteContract(optional).Access).toEqualTypeOf<'VIEWER' | undefined>();
const literal = { ...archive, path: '/people/:personId/archive', Access: 'OWNER' } as const;
expectTypeOf(endpointRouteContract(literal).Path).toEqualTypeOf<'/people/:personId/archive'>();
expectTypeOf(endpointRouteContract(literal).Access).toEqualTypeOf<'OWNER'>();

export function contractOf<Route extends EndpointRouteDescriptor>(route: Route): EndpointRouteContract<Route> {
  return endpointRouteContract(route);
}
export function contractForCrud<Options extends CrudRouteMetadataOptions>(route: CrudRouteMetadata<Options>) {
  return endpointRouteContract(route);
}
