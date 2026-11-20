import type { TransitionRouteMetadata } from '../state/transitionRouteMetadata.js';
import { ApiDefinitionError } from './ApiDefinitionError.js';
import type { CrudRouteMetadata } from './crudRouteMetadata.js';
import type { DeclaredOption } from './declaredOption.js';

/** Generated route descriptors that supply the public endpoint contract. */
export type EndpointRouteDescriptor = CrudRouteMetadata | TransitionRouteMetadata;

/** The public route members of one endpoint, retaining the selected descriptor and its access rule. */
export type EndpointRouteContract<Route extends EndpointRouteDescriptor = EndpointRouteDescriptor> = Route extends unknown ? {
  readonly Name: Route['name'];
  readonly Kind: Route['kind'];
  readonly Method: Route['method'];
  readonly Path: Route['path'];
  readonly Access: DeclaredOption<Route, 'Access'>;
  readonly Route: Route;
} : never;

/** Exposes a generated route and its resolved access rule as endpoint contract members. */
export function endpointRouteContract<const Route extends EndpointRouteDescriptor>(route: Route): EndpointRouteContract<Route>;
export function endpointRouteContract(route: EndpointRouteDescriptor & { readonly Access?: unknown }) {
  if (route?.kind !== 'crud' && route?.kind !== 'transition') {
    throw new ApiDefinitionError('Endpoint route contracts require a CRUD or transition route descriptor.');
  }
  return {
    Name: route.name,
    Kind: route.kind,
    Method: route.method,
    Path: route.path,
    Access: Object.hasOwn(route, 'Access') ? route.Access : undefined,
    Route: route,
  } as const;
}
