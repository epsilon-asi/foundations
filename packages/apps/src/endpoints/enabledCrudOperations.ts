import type { ResolveEndpointPrincipalsOptions } from '../tenancy/endpointPrincipals.js';
import type { EndpointScope, ResourceTenancy } from '../tenancy/endpointScope.js';
import { CRUD_OPERATIONS } from './crudOperations.js';
import type { DeclaredOption } from './declaredOption.js';

export type CrudOperation = keyof typeof CRUD_OPERATIONS;

/** Accepts named settings interfaces and inline declarations with additional operation options. */
export type CrudOperationOptions = (object | Record<string, unknown>) & Pick<ResolveEndpointPrincipalsOptions, 'principals' | 'tool'> & {
  /** OpenAPI visibility. Defaults to the resource-wide setting. */
  docs?: boolean;
  /** Endpoint scope. Defaults to the resource-wide setting. */
  scope?: EndpointScope;
};

export interface EnabledCrudOperationsOptions {
  /** Shared resources default to Get and List. Other resources default to all five operations. */
  tenancy?: ResourceTenancy;
  /** False disables an operation. True or an operation options object enables it. */
  operations?: Partial<Record<CrudOperation, boolean | CrudOperationOptions>>;
}

const operationNames = Object.keys(CRUD_OPERATIONS) as CrudOperation[];
const sharedDefaults = { Get: true, List: true } as const satisfies Partial<Record<CrudOperation, true>>;

type DisabledSetting<Options, Name extends CrudOperation, Tenancy = DeclaredOption<Options, 'tenancy'>> =
  unknown extends Tenancy ? false : [Tenancy] extends ['shared']
    ? Name extends keyof typeof sharedDefaults ? false : false | undefined
    : false;

/** The settings under which this operation can produce a route. Undefined uses its tenancy default. */
export type EnabledCrudSetting<Options, Name extends CrudOperation, Operations = DeclaredOption<Options, 'operations'>> =
  unknown extends Operations ? unknown : Exclude<DeclaredOption<Operations, Name>, DisabledSetting<Options, Name>>;

/** Operation names that can be enabled by the declared resource options. */
export type EnabledCrudOperation<Options extends EnabledCrudOperationsOptions = EnabledCrudOperationsOptions> =
  Options extends unknown ? {
    [Name in CrudOperation]: [EnabledCrudSetting<Options, Name>] extends [never] ? never : Name;
  }[CrudOperation] : never;

/** Only own declarations can enable a shared write or override endpoint options. */
export function crudOperationOverride(options: EnabledCrudOperationsOptions, name: CrudOperation) {
  const operations = Object.hasOwn(options, 'operations') ? options.operations : undefined;
  return operations && Object.hasOwn(operations, name) ? operations[name] : undefined;
}

/** Returns enabled operation names in CRUD_OPERATIONS order. */
export function enabledCrudOperations<const Options extends EnabledCrudOperationsOptions>(options: Options): EnabledCrudOperation<Options>[];
export function enabledCrudOperations(options?: EnabledCrudOperationsOptions): CrudOperation[];
export function enabledCrudOperations(options: EnabledCrudOperationsOptions = {}): CrudOperation[] {
  return operationNames.filter(name => {
    const override = crudOperationOverride(options, name);
    if (override === undefined) return options.tenancy !== 'shared' || Object.hasOwn(sharedDefaults, name);
    if (typeof override === 'boolean') return override;
    if (Object.prototype.toString.call(override) === '[object Object]') return true;
    throw new TypeError(`CRUD operation "${name}" requires a boolean or an options object.`);
  });
}
