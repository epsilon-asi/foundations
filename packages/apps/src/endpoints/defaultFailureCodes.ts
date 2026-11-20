import { CLIENT_FAILURE_CODES } from '../responses/clientFailureCodes.js';
import { SERVER_FAILURE_CODES } from '../responses/serverFailureCodes.js';
import { DEFAULT_ENDPOINT_SCOPE, EndpointScope } from '../tenancy/endpointScope.js';
import type { CrudOperation } from './enabledCrudOperations.js';
import { pathParameterNames } from './pathParameterNames.js';

const authenticatedCodes = [
  CLIENT_FAILURE_CODES.Unauthorized, CLIENT_FAILURE_CODES.Forbidden, SERVER_FAILURE_CODES.ServiceUnavailable,
] as const;
type AuthenticatedCode = (typeof authenticatedCodes)[number];
type TenantCode = typeof CLIENT_FAILURE_CODES.BadRequest;

/** Statuses possible for the given scope. The route, operation and guards determine the actual list. */
export type DefaultFailureCode<Scope extends EndpointScope = EndpointScope> =
  | Exclude<CLIENT_FAILURE_CODES | SERVER_FAILURE_CODES, AuthenticatedCode | TenantCode>
  | (Scope extends typeof EndpointScope.Public ? never : AuthenticatedCode)
  | (Scope extends typeof EndpointScope.Tenant ? TenantCode : never);

export interface DefaultFailureCodesOptions {
  /** Declared route template, including any named path parameters. */
  path: string;
  /** Resolved endpoint scope. Defaults to tenant. */
  scope?: EndpointScope;
  /** CRUD operation, when deriving failures for a CRUD route. */
  operation?: CrudOperation;
  /** Whether requireBudget applies to this endpoint. Default: false. */
  requiresBudget?: boolean;
  /** Whether a feature rule applies to this endpoint. Default: false. */
  requiresFeature?: boolean;
}

/** Derives the endpoint's default HTTP failure statuses in ascending order. */
export function defaultFailureCodes<Scope extends EndpointScope>(
  options: DefaultFailureCodesOptions & { scope: Scope },
): DefaultFailureCode<Scope>[];
export function defaultFailureCodes(options: DefaultFailureCodesOptions): DefaultFailureCode[];
export function defaultFailureCodes({
  path, scope = DEFAULT_ENDPOINT_SCOPE, operation, requiresBudget, requiresFeature,
}: DefaultFailureCodesOptions): DefaultFailureCode[] {
  const codes: DefaultFailureCode[] = [
    CLIENT_FAILURE_CODES.UnprocessableEntity, CLIENT_FAILURE_CODES.TooManyRequests, SERVER_FAILURE_CODES.InternalServerError,
  ];
  if (scope !== EndpointScope.Public) codes.push(...authenticatedCodes);
  if (scope === EndpointScope.Tenant) codes.push(CLIENT_FAILURE_CODES.BadRequest);
  if (requiresBudget || requiresFeature) codes.push(CLIENT_FAILURE_CODES.PaymentRequired);
  if (scope === EndpointScope.Tenant || pathParameterNames(path).length > 0) codes.push(CLIENT_FAILURE_CODES.NotFound);
  if (operation === 'Create' || operation === 'Update' || operation === 'Delete') codes.push(CLIENT_FAILURE_CODES.Conflict);
  return codes.sort((a, b) => a - b);
}
