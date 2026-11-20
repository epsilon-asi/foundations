import { CLIENT_FAILURE_CODES } from '../responses/clientFailureCodes.js';
import { SERVER_FAILURE_CODES } from '../responses/serverFailureCodes.js';
import { DEFAULT_ENDPOINT_SCOPE, EndpointScope } from '../tenancy/endpointScope.js';
import type { BoundPathParamNames } from './crudRouteMetadata.js';
import type { DeclaredOption } from './declaredOption.js';
import type { CrudOperation } from './enabledCrudOperations.js';
import { pathParameterNames } from './pathParameterNames.js';

const authenticatedCodes = [
  CLIENT_FAILURE_CODES.Unauthorized, CLIENT_FAILURE_CODES.Forbidden, SERVER_FAILURE_CODES.ServiceUnavailable,
] as const;
const conflictOperations = ['Create', 'Update', 'Delete'] as const satisfies readonly CrudOperation[];
type AuthenticatedCode = (typeof authenticatedCodes)[number];
type TenantCode = typeof CLIENT_FAILURE_CODES.BadRequest;
type ConflictCode = typeof CLIENT_FAILURE_CODES.Conflict;
type PaymentCode = typeof CLIENT_FAILURE_CODES.PaymentRequired;
type NotFoundCode = typeof CLIENT_FAILURE_CODES.NotFound;
type WriteOperation = (typeof conflictOperations)[number];
type PaymentGuard = 'requiresBudget' | 'requiresFeature';
type Unguarded = { [Key in PaymentGuard]?: false | undefined };
type ReadOrAction = { operation?: Exclude<CrudOperation, WriteOperation> };

type ParameterMarker = `${string}:${string}` | `${string}*${string}`;
// The runtime parser consumes each escaped character before looking for a named parameter.
type LiteralPathFailure<Path extends string> = Path extends `${infer Prefix}\\${infer _Escaped}${infer Rest}`
  ? Prefix extends ParameterMarker ? NotFoundCode : LiteralPathFailure<Rest>
  : Path extends ParameterMarker ? NotFoundCode : never;
// Open template strings can include a parameter even when their fixed segments contain none.
type ExternalPathFailure<Path extends string> = {} extends Record<Path, unknown> ? NotFoundCode : LiteralPathFailure<Path>;
type PathFailure<Path extends string> = Path extends unknown
  ? string extends BoundPathParamNames<Path> ? ExternalPathFailure<Path>
    : [BoundPathParamNames<Path>] extends [never] ? never : NotFoundCode
  : never;

/** Statuses possible for the given scope, CRUD operation, payment guards and route path. */
export type DefaultFailureCode<
  Scope extends EndpointScope = EndpointScope, Operation extends CrudOperation | undefined = CrudOperation, Guard extends boolean | undefined = boolean,
  Path extends string = string,
> =
  | Exclude<CLIENT_FAILURE_CODES | SERVER_FAILURE_CODES, AuthenticatedCode | TenantCode | ConflictCode | PaymentCode | NotFoundCode>
  | (Scope extends typeof EndpointScope.Public ? never : AuthenticatedCode)
  | (Scope extends typeof EndpointScope.Tenant ? TenantCode | NotFoundCode : never)
  | PathFailure<Path>
  | (Operation extends WriteOperation ? ConflictCode : never)
  | (Guard extends true ? PaymentCode : never);

export interface DefaultFailureCodesOptions {
  /** Declared route template, including any named path parameters. */
  path: string;
  /** Resolved endpoint scope. Defaults to tenant. */
  scope?: EndpointScope;
  /** CRUD operation, when deriving failures for a CRUD route. */
  operation?: CrudOperation;
  /** Whether requireBudget applies to this endpoint. Default: false. */
  requiresBudget?: boolean | undefined;
  /** Whether a feature rule applies to this endpoint. Default: false. */
  requiresFeature?: boolean | undefined;
}

// An optional scope can use the tenant default, which includes every scope-dependent status.
type FailureScope<Options> = Options extends { scope: infer Scope extends EndpointScope } ? Scope : typeof DEFAULT_ENDPOINT_SCOPE;

/** The default statuses for a declaration, including its scope fallback, possible writes and payment guards. */
export type DefaultFailureCodeFor<Options extends DefaultFailureCodesOptions> = DefaultFailureCode<
  FailureScope<Options>, CrudOperation & DeclaredOption<Options, 'operation'>, boolean & DeclaredOption<Options, PaymentGuard>, Options['path']
>;

/** Derives the endpoint's default HTTP failure statuses in ascending order. */
export function defaultFailureCodes<
  Scope extends EndpointScope, const Options extends DefaultFailureCodesOptions,
>(options: Options & { scope?: Scope }): DefaultFailureCodeFor<Options>[];
export function defaultFailureCodes<Scope extends EndpointScope>(
  options: DefaultFailureCodesOptions & { scope: Scope } & ReadOrAction & Unguarded,
): DefaultFailureCode<Scope, undefined, false>[];
export function defaultFailureCodes<Scope extends EndpointScope>(
  options: DefaultFailureCodesOptions & { scope: Scope } & Unguarded,
): DefaultFailureCode<Scope, CrudOperation, false>[];
export function defaultFailureCodes<Scope extends EndpointScope>(
  options: DefaultFailureCodesOptions & { scope: Scope } & ReadOrAction,
): DefaultFailureCode<Scope, undefined>[];
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
  if (conflictOperations.some(name => name === operation)) codes.push(CLIENT_FAILURE_CODES.Conflict);
  return codes.sort((a, b) => a - b);
}
