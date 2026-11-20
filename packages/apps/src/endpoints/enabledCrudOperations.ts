import type { ResolveEndpointPrincipalsOptions } from '../tenancy/endpointPrincipals.js';
import type { EndpointScope, ResourceTenancy } from '../tenancy/endpointScope.js';
import { CRUD_OPERATIONS } from './crudOperations.js';

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

/** Only own declarations can enable a shared write or override endpoint options. */
export function crudOperationOverride(options: EnabledCrudOperationsOptions, name: CrudOperation) {
  const operations = Object.hasOwn(options, 'operations') ? options.operations : undefined;
  return operations && Object.hasOwn(operations, name) ? operations[name] : undefined;
}

/** Returns enabled operation names in CRUD_OPERATIONS order. */
export function enabledCrudOperations(options: EnabledCrudOperationsOptions = {}): CrudOperation[] {
  return operationNames.filter(name => {
    const override = crudOperationOverride(options, name);
    if (override === undefined) return options.tenancy !== 'shared' || name === 'Get' || name === 'List';
    if (typeof override === 'boolean') return override;
    if (Object.prototype.toString.call(override) === '[object Object]') return true;
    throw new TypeError(`CRUD operation "${name}" requires a boolean or an options object.`);
  });
}
