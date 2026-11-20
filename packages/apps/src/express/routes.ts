import { createDecoratorRegistry } from '@epsilon-asi/foundation';
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';
import { assertUniqueRoutes } from '../endpoints/assertUniqueRoutes.js';
import type { RequestOf, ResponseDataOf } from '../endpoints/endpointTypes.js';
import type { CrudOperation } from '../endpoints/enabledCrudOperations.js';
import type { HttpEndpoint } from '../endpoints/httpEndpoint.js';
import type { Failure } from '../responses/failure.js';
import type { HttpContext } from './pipeline.js';

export type { HttpEndpoint } from '../endpoints/httpEndpoint.js';

export const DEFAULT_ROUTES_DIR = 'routes';
export type RouteClass = new () => object;

export interface BoundRoute<E extends HttpEndpoint = HttpEndpoint> {
  readonly endpoint: E;
  handle(request: RequestOf<E>, context: HttpContext): unknown;
}

export interface HandlerOptions<E extends HttpEndpoint> {
  handle(request: RequestOf<E>, context: HttpContext): ResponseDataOf<E> | Failure | Promise<ResponseDataOf<E> | Failure>;
}

/** Defaults match generated endpoints by resource identity and operation at startup. */
type ResourceHandlers = { readonly resource: object } & Partial<Record<CrudOperation, BoundRoute['handle']>>;
type RouteDefault = ResourceHandlers | BoundRoute;

export interface RoutesOptions {
  /** Explicit class fields override the corresponding defaults. */
  defaults?: ResourceHandlers | readonly (RouteDefault | readonly RouteDefault[])[];
}

export interface ResolveRoutesOptions {
  /** Independent contract inventory, or the subset served by this application. */
  endpoints: readonly HttpEndpoint[];
  /** Explicit route classes. Omit to discover exported @Routes classes beside the entry. */
  routes?: readonly RouteClass[];
  /** Entry module path or import.meta.url. Defaults to the running entry module. */
  entry?: string | URL;
  /** Relative to the entry module directory. Default: routes. */
  routesDir?: string;
}

export interface RouteSystem {
  Routes(options?: RoutesOptions): <C extends RouteClass>(target: C, context: ClassDecoratorContext<C>) => void;
  handler<E extends HttpEndpoint>(endpoint: E, options: HandlerOptions<NoInfer<E>>): BoundRoute<E>;
  resolve(options: ResolveRoutesOptions): Promise<BoundRoute[]>;
}

type RouteDecorators = {
  class: { routes: { metadata: () => RoutesOptions } };
  property: {}; method: {}; accessor: {};
};

async function discoverRoutes({ entry = process.argv[1], routesDir = DEFAULT_ROUTES_DIR }: ResolveRoutesOptions,
  isRouteClass: (value: unknown) => value is RouteClass): Promise<RouteClass[]> {
  if (!entry) throw new ApiDefinitionError('Route discovery requires an entry module or explicit routes classes.');
  const entryPath = entry instanceof URL || entry.startsWith('file:') ? fileURLToPath(entry) : entry;
  const directory = resolve(dirname(entryPath), routesDir);
  const entries = await readdir(directory, { withFileTypes: true, recursive: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT' && error.path === directory) return [];
    throw error;
  });
  const files = entries.filter(file => file.isFile() && /Routes\.[cm]?[jt]s$/.test(file.name))
    .map(file => join(file.parentPath, file.name)).sort();
  const classes = new Set<RouteClass>();
  for (const file of files) {
    const module = await import(pathToFileURL(file).href) as Record<string, unknown>;
    for (const candidate of Object.values(module)) {
      if (isRouteClass(candidate)) classes.add(candidate);
    }
  }
  return [...classes];
}

/** Groups declarative route classes without sharing handlers across running apps. */
export function createRouteSystem(): RouteSystem {
  const registry = createDecoratorRegistry<RouteDecorators>({ namespace: 'http-routes' });
  const decorate = registry.class('routes');
  const bindings = new WeakSet<object>();

  function isBinding(value: unknown): value is BoundRoute {
    return typeof value === 'object' && value !== null && bindings.has(value);
  }
  function metadata(target: RouteClass) {
    return registry.read(target, { includeInherited: false }).firstClass('routes')?.metadata as (() => RoutesOptions) | undefined;
  }
  function isRouteClass(value: unknown): value is RouteClass {
    return typeof value === 'function' && metadata(value as RouteClass) !== undefined;
  }
  function classBindings(target: RouteClass, endpoints: readonly HttpEndpoint[]) {
    const settings = metadata(target);
    if (!settings) throw new ApiDefinitionError(`Routes class "${target.name}" must use this system's @Routes().`);
    const explicit = new Map<HttpEndpoint, BoundRoute>();
    const instance = new target();
    for (const field of Reflect.ownKeys(instance)) {
      const value: unknown = Object.getOwnPropertyDescriptor(instance, field)?.value;
      if (!isBinding(value)) continue;
      if (explicit.has(value.endpoint)) {
        throw new ApiDefinitionError(`${target.name}.${String(field)} duplicates the handler for ${value.endpoint.Name}.`);
      }
      explicit.set(value.endpoint, value);
    }
    const routes = new Map<HttpEndpoint, BoundRoute>();
    function addDefault(binding: BoundRoute) {
      if (routes.has(binding.endpoint)) throw new ApiDefinitionError(`Duplicate default for ${binding.endpoint.Name} on "${target.name}".`);
      routes.set(binding.endpoint, binding);
    }
    const defaults = settings().defaults ?? [];
    for (const value of [defaults].flat(2)) {
      if (isBinding(value)) {
        addDefault(value);
      } else if (value && typeof value === 'object' && 'resource' in value && value.resource) {
        for (const endpoint of endpoints) {
          const operation = endpoint.Route.operation;
          if (endpoint.Resource !== value.resource || !operation) continue;
          const handle = value[operation];
          if (handle === undefined) continue;
          if (typeof handle !== 'function') throw new ApiDefinitionError(`Invalid ${operation} default on "${target.name}".`);
          addDefault({ endpoint, handle });
        }
      } else {
        throw new ApiDefinitionError(`Invalid default handler on "${target.name}".`);
      }
    }
    for (const [endpoint, route] of explicit) routes.set(endpoint, route);
    return routes.values();
  }
  return {
    Routes: (options = {}) => decorate(() => options),
    handler(endpoint, { handle }) {
      if (!endpoint || typeof endpoint.Name !== 'string' || !endpoint.Route) {
        throw new ApiDefinitionError('handler() requires an enabled endpoint declaration.');
      }
      if (typeof handle !== 'function') throw new ApiDefinitionError(`Handler for ${endpoint.Name} requires a handle function.`);
      const bound = Object.freeze({ endpoint, handle });
      bindings.add(bound);
      return bound;
    },
    async resolve(options) {
      const { endpoints } = options;
      assertUniqueRoutes(endpoints.map(endpoint => endpoint.Route));
      const expected = new Set(endpoints);
      const classes = options.routes ?? await discoverRoutes(options, isRouteClass);
      const resolved = new Map<HttpEndpoint, BoundRoute>();
      for (const target of classes) {
        for (const route of classBindings(target, endpoints)) {
          const { endpoint } = route;
          if (!expected.has(endpoint)) throw new ApiDefinitionError(`${target.name} binds ${endpoint.Name} outside this API's endpoint declarations.`);
          if (resolved.has(endpoint)) throw new ApiDefinitionError(`Multiple handlers for ${endpoint.Name} (including ${target.name}).`);
          resolved.set(endpoint, route);
        }
      }
      const missing = endpoints.filter(endpoint => !resolved.has(endpoint));
      if (missing.length) throw new ApiDefinitionError(`Missing handlers for: ${missing.map(endpoint => endpoint.Name).join(', ')}.`);
      return [...resolved.values()];
    },
  };
}

export const routeSystem = createRouteSystem();
export const { Routes, handler } = routeSystem;
