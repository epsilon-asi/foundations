import {
  createTypeRegistry, TypeRegistryError, type Constructor, type ResolvedType, type TypeClassDecorator, type TypeOptions, type TypeRegistry,
} from '@epsilon-asi/foundation';
import type { z } from 'zod/v4';
import { assertOptionNamesAvailable } from '../endpoints/assertOptionNamesAvailable.js';
import { createEndpoints, type CheckedListDeclaration, type ResourceEndpoints, type ResourceEndpointsOptions } from '../endpoints/createEndpoints.js';
import type { HttpEndpoint } from '../endpoints/httpEndpoint.js';
import type { ResourceTenancy } from '../tenancy/endpointScope.js';
import { tenantNames, type TenantNamesOptions } from '../tenancy/tenantNames.js';
import { apiVersionSchema } from './apiVersion.js';
import { crudExtension } from './extensions/crud.js';
import { httpExtension } from './extensions/http.js';
import { uiExtension } from './extensions/ui.js';
import { resolveTenantField } from './resolveTenantField.js';
import { ResourceDefinitionError } from './ResourceDefinitionError.js';
import { resourceProp, type ResourceProp } from './resourceProp.js';
import { resourceVariants, type ResourceVariants } from './resourceVariants.js';
import { fieldOperations } from './selectOperationFields.js';

export type { CreatedFields } from './types.js';
export type { ResourceWire, ResourceVariants } from './resourceVariants.js';
export type { ResourceProp } from './resourceProp.js';

export type ResourceExtensions = {
  crud: typeof crudExtension;
  http: typeof httpExtension;
  ui: typeof uiExtension;
};
type Registry = TypeRegistry<ResourceExtensions>;

export type ResourceOptions = TypeOptions<ResourceExtensions> & {
  /** Owned when the system has a tenant. The tenant class itself uses self. */
  tenancy?: ResourceTenancy;
  owner?: string;
};
export interface ResourceModel<C extends Constructor> extends ResolvedType<InstanceType<C>, ResourceExtensions>, ResourceVariants<C> {
  readonly tenancy?: ResourceTenancy;
  readonly owner?: string;
}

type TenantSource = () => Constructor;
export interface CreateResourceSystemOptions {
  /** Omit for a system without tenant ownership. Resolution is lazy for forward references. */
  tenant?: TenantSource | (Omit<TenantNamesOptions, 'resource'> & { resource: TenantSource });
  /** Ordered from lowest to highest. */
  roles?: readonly string[];
  /** Default endpoint rule. Falls back to the highest configured role. */
  access?: string | object;
  /** Default API version sent by this system's clients. */
  apiVersion?: string;
}

export interface ResourceSystem {
  /** Enabled endpoint declarations, independent of any loaded routes modules. */
  readonly declaredEndpoints: readonly HttpEndpoint[];
  /** Application role order, lowest to highest. */
  readonly roles: readonly string[];
  readonly Type: Registry['Type'];
  readonly Resource: (options?: ResourceOptions) => TypeClassDecorator;
  readonly Prop: ResourceProp;
  readonly ref: Registry['ref'];
  resolve<C extends Constructor>(target: C): ResourceModel<C>;
  endpoints<C extends Constructor, const Options extends ResourceEndpointsOptions & CheckedListDeclaration<C, Options>>(target: C, options: Options): ResourceEndpoints<C, Options>;
}

// Adapters given only a decorated class resolve it through the system that declared it.
// A shared class can still be resolved explicitly through either of its systems.
const resourceResolvers = new WeakMap<Constructor, ResourceSystem['resolve'] | null>();

export function resourceModelFor<C extends Constructor>(target: C, resources?: Pick<ResourceSystem, 'resolve'>): ResourceModel<C> {
  if (resources) return resources.resolve(target);
  const resolve = resourceResolvers.get(target);
  if (resolve === null) throw new ResourceDefinitionError(`"${target.name}" is declared in multiple resource systems. Pass its resources explicitly.`);
  if (!resolve) throw new ResourceDefinitionError(`"${target.name}" is missing its @Resource declaration.`);
  return resolve(target);
}

/** Binds decorated resource declarations, variant caches and endpoint defaults to one application. */
export function createResourceSystem(options: CreateResourceSystemOptions = {}): ResourceSystem {
  const registry = createTypeRegistry({ namespace: 'resources' }).use(crudExtension).use(httpExtension).use(uiExtension);
  const resources = new WeakMap<Constructor, ResourceOptions>();
  const contracts: HttpEndpoint[] = [];
  const cache = new WeakMap<Constructor, ResourceModel<Constructor>>();
  const checkedAccess = new WeakSet<Constructor>();
  const references = new WeakMap<() => z.core.$ZodType, () => Constructor>();
  const tenant = typeof options.tenant === 'function' ? { resource: options.tenant } : options.tenant;
  const apiVersion = apiVersionSchema.parse(options.apiVersion);
  const roles = Object.freeze([...(options.roles ?? [])]);
  const defaultAccess = options.access ?? roles.at(-1);

  const ref: Registry['ref'] = target => {
    const schema = registry.ref(target);
    const node: z.core.$ZodType = schema;
    const def = (node as z.core.$ZodTypes)._zod.def;
    if (def.type !== 'lazy') throw new ResourceDefinitionError('A registry reference must be lazy.');
    references.set(def.getter, target);
    return schema;
  };

  function Resource(settings: ResourceOptions = {}): TypeClassDecorator {
    assertOptionNamesAvailable(settings);
    if (Object.hasOwn(settings, 'refine')) {
      throw new ResourceDefinitionError('Resource-level refinements are not supported in Create contracts yet.');
    }
    const { tenancy, owner, ...type } = settings;
    const decorate = registry.Type(type);
    return (target, context) => {
      decorate(target, context);
      resources.set(target, { name: type.name, tenancy, owner });
      resourceResolvers.set(target, resourceResolvers.has(target) && resourceResolvers.get(target) !== resolve ? null : resolve);
    };
  }

  function resolveMetadata<C extends Constructor>(target: C): ResolvedType<InstanceType<C>, ResourceExtensions> {
    const model = registry.resolve(target);
    if (checkedAccess.has(target)) return model;
    const parent: Constructor | undefined = Object.getPrototypeOf(target);
    if (parent && parent !== Function.prototype) {
      let base: ResolvedType<unknown, ResourceExtensions> | undefined;
      try {
        base = resolveMetadata(parent);
      } catch (error) {
        // A resource may extend an ordinary class with no decorations in this registry.
        if (!(error instanceof TypeRegistryError && error.message.endsWith('has no @Type or @Prop decorations.'))) throw error;
      }
      if (base) {
        for (const [name, inherited] of base.fields) {
          const override = model.fields.get(name);
          const grants = fieldOperations(inherited);
          if (override && fieldOperations(override).some(operation => !grants.includes(operation))) {
            throw new ResourceDefinitionError(`${model.name}.${name} widens inherited access.`);
          }
        }
      }
    }
    checkedAccess.add(target);
    return model;
  }

  function resolve<C extends Constructor>(target: C): ResourceModel<C> {
    const cached = cache.get(target);
    if (cached) return cached as ResourceModel<C>;
    const metadata = resolveMetadata(target);
    const settings = resources.get(target);
    if (!settings) throw new ResourceDefinitionError(`"${metadata.name}" is not a resource declared in this system.`);
    const tenancy = tenant && target === tenant.resource() ? 'self' : settings.tenancy ?? (tenant ? 'owned' : undefined);
    const variants = resourceVariants(target, { resolve: resolveMetadata, references });
    const model: ResourceModel<C> = { ...metadata, ...variants, tenancy, owner: settings.owner };
    cache.set(target, model as ResourceModel<Constructor>);
    return model;
  }

  function endpoints<C extends Constructor, const Options extends ResourceEndpointsOptions & CheckedListDeclaration<C, Options>>(target: C, declaration: Options): ResourceEndpoints<C, Options> {
    const model = resolve(target);
    const name = resources.get(target)?.name;
    // An optimized production bundle can rename the class. Only an explicit resource
    // name remains authoritative there. In a development host also catch class-name typos.
    const env = (globalThis as { process?: { env?: { APP_ENV?: string; NODE_ENV?: string } } }).process?.env;
    const mode = env?.APP_ENV ?? env?.NODE_ENV;
    const expectedName = name ?? (mode === 'test' || mode === 'development' ? target.name : undefined);
    if (expectedName !== undefined && declaration.name !== expectedName) {
      throw new ResourceDefinitionError(`Resource "${expectedName}" cannot declare endpoints named "${declaration.name}".`);
    }
    const names = tenant && tenantNames({ ...tenant, resource: registry.resolve(tenant.resource()).name });
    if (names && model.tenancy === 'owned' && resolveTenantField(model).name !== names.field) {
      throw new ResourceDefinitionError(`Tenant-owned resource "${model.name}" requires the tenant field "${names.field}".`);
    }
    return createEndpoints<C, Options>(model, declaration, {
      tenantHeader: names?.header, tenantContext: names?.context, apiVersion, defaultAccess,
      register: endpoint => contracts.push(endpoint),
    });
  }
  return {
    Resource, Type: registry.Type, Prop: resourceProp(registry, ref), ref, resolve, endpoints, roles,
    get declaredEndpoints() { return Object.freeze([...contracts]); },
  };
}
