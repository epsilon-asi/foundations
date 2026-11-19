# @epsilon-asi/apps

The browser-safe package root exports resource model types, the `newId()` UUID generator, and CRUD, HTTP and UI metadata. It derives CRUD endpoint names and paths, tenant names and translation keys. It also provides CRUD methods and success codes, typed success and failure responses, list query primitives, and date, number and boolean wire codecs. [Resource framework plan](https://github.com/epsilon-asi/foundations/blob/main/docs/plans/resource-framework.md)

The [naming guide](docs/CONVENTIONS.md) covers the planned file names, exports and discovery rules for application code. It ships with the package.

The root depends on foundation and Zod. Express, Redis and Google Cloud Pub/Sub are optional peers for planned adapters. The planned billing adapter declares `stripe` (`^23.1.0`) as an optional peer. The planned ORM adapter declares `@mikro-orm/core` and `@mikro-orm/migrations` as optional peers with the same version range. PostgreSQL and SQLite are development drivers. An empty project can install and import the packed root with just foundation and Zod.

## Resource model primitives

Field types declare which operations may use a value. They accept ordinary values and preserve `null` and `undefined` in unions. Runtime request validation and response projection are planned separately.

| Field type | Read | Create | Update |
|---|---|---|---|
| `Readable<T>` | Yes | — | — |
| `Id<T>` (primary key) | Yes | — | — |
| `Tenant<T>` (owning tenant's ID) | Yes | — | — |
| `Editable<T>` | Yes | Yes | Yes |
| `CreateOnly<T>` | Yes | Yes | — |
| `UpdateOnly<T>` | Yes | — | Yes |
| `WriteOnly<T>` | — | Yes | Yes |
| `Internal<T>` | — | — | — |
| `Secret<T>` | — | — | — |

```ts
import {
  newId, type CreateInput, type Editable, type Fields, type Id, type IdOf, type Internal,
  type Readable, type ReadModel, type Secret, type Tenant, type UpdateInput, type WriteOnly,
} from '@epsilon-asi/apps';

interface Account {
  key: Id<string>;
  organizationId: Tenant<string>;
  displayName: Editable<string | null>;
  manager?: Readable<Account>;
  password: WriteOnly<string>;
  reviewNote?: Internal<string>;
  signingKey: Secret<string>;
  refresh(): void;
}

type AccountFields = Fields<Account>;
type AccountResponse = ReadModel<Account>;
const signup: CreateInput<Account> = { displayName: null, password: 'example' };
const passwordChange: UpdateInput<Account> = { password: 'replacement' };
const accountId: IdOf<Account> = newId();
```

`IdOf<Account>` finds the field marked `Id<T>` and returns its plain value type. Here the result is `string`, taken from `key`. For a class, you can pass its instance type or its constructor type. A model without an `Id<T>` field yields `never`.

`Fields<Account>` keeps the declared data, including `reviewNote` and `signingKey`, and omits the `refresh` method. `AccountResponse` exposes `key`, `organizationId`, `displayName` and the optional `manager`. IDs become plain strings, and a manager has the same readable subset as its parent. This projection describes a TypeScript type. Runtime response filtering is a separate step in the plan.

Within a `ReadModel`, nested resource classes and interfaces expose only fields with read access. For plain JSON data, an inline record such as `Editable<{ seats: number }>` preserves its ordinary keys. A nested interface with no access markers or string index signature has no readable keys.

`CreateInput<Account>` requires `displayName` and the write-only `password`. The server supplies `key` and `organizationId`, so TypeScript rejects both in a create object literal. Nested resources follow the same create rules. A create-writable field can be omitted when declared with `?` or wrapped in `Defaulted<T>`.

`UpdateInput<Account>` makes every update-writable field optional, so a patch can be empty or contain only the new password. It includes `Editable`, `UpdateOnly` and `WriteOnly` fields and applies the same rules to nested resources. For a resource containing only create-only or server-set fields, the only valid patch literal is `{}`.

`Internal<T>` makes the default server-only intent explicit. `Secret<T>` adds a type-only marker for sensitive values. The plan assigns runtime encryption and log redaction to later implementation steps.

`newId()` uses Web Crypto to generate a UUIDv7. IDs from different milliseconds sort by timestamp. IDs from the same millisecond have 74 random bits. [UUIDv7 format](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.7)

Register `crudExtension`, `httpExtension` and `uiExtension` with a foundation type registry to record field and model metadata. Use a CRUD preset string when access is all you need. The presets are `readable`, `editable`, `createOnly`, `updateOnly`, `writeOnly`, `id`, `tenant`, `internal` and `secret`.

The CRUD object form accepts `access`, a boolean `id` flag and `patch`. All three keys are optional. The planned update behavior defaults to `replace`, with `merge` for objects and `append` for arrays. The registry preserves omitted options.

```ts
import {
  crudExtension, fieldMessageKeys, httpExtension, uiExtension, type CreateInput,
  type CreateOnly, type Defaulted, type Editable,
} from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';

const { Type, Prop, resolve } = createTypeRegistry().use(crudExtension).use(httpExtension).use(uiExtension);

@Type({ name: 'Contact', ui: { label: 'contact.label', plural: 'contact.plural' } })
class Contact {
  @Prop.string({
    crud: 'createOnly', http: { name: 'external_id' },
    ui: { placeholder: 'integrations.idPrompt', order: 1 },
  })
  externalId!: CreateOnly<string>;

  @Prop(z.array(z.string()).default([]), { crud: { access: 'editable', patch: 'append' } })
  tags!: Defaulted<Editable<string[]>>;
}

const newContact: CreateInput<typeof Contact> = { externalId: 'customer-17' };
const { name, fields } = resolve(Contact);
const externalId = fields.get('externalId')!;
const keys = fieldMessageKeys({ resource: name, field: externalId.name, ui: externalId.extensions.ui });
// keys.label is 'contact.externalId', keys.placeholder is 'integrations.idPrompt',
// and keys.helperText is 'contact.externalId.helper'.
// fields.get('externalId')?.extensions.http?.name is 'external_id'.
// fields.get('tags')?.extensions.crud is { access: 'editable', patch: 'append' }.
```

The HTTP wire name leaves the class and schema property name intact. Each endpoint will choose where it sends the field.

`uiExtension` stores optional `label` and `plural` message keys on the model. Each field can supply `label`, `placeholder` and `helperText` message keys, string `input` and `autoComplete` hints, a boolean `multiline` flag and numeric `order`. The registry preserves omitted hints. `fieldMessageKeys()` camel-cases the resource name and uses the model field name to derive each missing key. An explicit label, placeholder or helper text overrides only its own key. Declaring `name: 'Contact'` keeps those keys stable when a bundler renames the class.

`Defaulted<T>` marks a schema-supplied default and preserves the wrapped type's read and write permissions. In the example, the Zod schema supplies an empty array when the input omits `tags`.

## Enum option labels

`enumOptionMessageKey()` appends the stored enum value to the resource and field names. String values keep their casing. Numeric enums use their stored number, so a value of `0` gives a key ending in `.0`.

```ts
import { enumOptionMessageKey } from '@epsilon-asi/apps';

const draftLabel = enumOptionMessageKey({ resource: 'Offering', field: 'status', value: 'DRAFT' });
// 'offering.status.DRAFT'
```

## Tenant names

`tenantNames()` takes the declared singular resource name. For `Organization`, it derives the header `X-Organization-Id`, the request context key `organization` and the model field `organizationId`. Each name can be overridden independently.

```ts
import { tenantNames } from '@epsilon-asi/apps';

const names = tenantNames({ resource: 'Organization', header: 'X-Tenant-Id' });
// { header: 'X-Tenant-Id', context: 'organization', field: 'organizationId' }
```

## Endpoint scopes

`endpointScopeSchema` accepts `tenant`, `account` and `public`. An omitted scope defaults to `DEFAULT_ENDPOINT_SCOPE` (`'tenant'`). The reserved value `platform` fails validation. Use the schema on the `scope` property of a declaration.

```ts
import { EndpointScope, endpointScopeSchema } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const declaration = z.object({ scope: endpointScopeSchema });
const tenantEndpoint = declaration.parse({}); // { scope: 'tenant' }
const accountEndpoint = declaration.parse({ scope: EndpointScope.Account });
```

## CRUD endpoint names

`crudEndpointNames()` derives five export names from the singular resource name. For `Offering` they are `CreateOffering`, `GetOffering`, `UpdateOffering`, `DeleteOffering` and `ListOfferings`. The list name uses the default plural formed by appending `s`. Pass `plural` for a spelling such as `Companies`.

```ts
import { crudEndpointNames, crudPaths, itemParamName, listResponseKey } from '@epsilon-asi/apps';

const companyEndpoints = crudEndpointNames({ name: 'Company', plural: 'Companies' });
// companyEndpoints.Get is 'GetCompany' and companyEndpoints.List is 'ListCompanies'.
const apiKeyPaths = crudPaths({ name: 'ApiKey' }); // { collection: '/api-keys', item: '/api-keys/:apiKeyId' }
const apiKeyParam = itemParamName('ApiKey'); // 'apiKeyId' in /api-keys/:apiKeyId
const companyListKey = listResponseKey({ name: 'Company', plural: 'Companies' }); // 'companies'
```

`crudPaths()` returns the collection and item path templates. The plural forms one static collection segment. An explicit plural such as `Companies` gives `/companies` and `/companies/:companyId`.

`itemParamName()` returns the flat request field used in an item route. Use the singular resource name and write acronyms as words. For example, the helper rejects `APIKey` because its camel-case spelling would disagree with its TypeScript literal type.

`listResponseKey()` returns the property that holds the rows in a list response. It uses the same plural as the list endpoint and converts it to camel case. For example, `ListApiKeys` uses `apiKeys`, and `ListCompanies` uses `companies`.

## Parent-scoped paths

Pass the parent’s singular name and optional plural to prefix both child paths with the parent’s item path. Each ID maps to its own flat request field. The helper rejects a pair that would give both IDs the same field name. The tenant ID travels in the header.

```ts
import { crudPaths } from '@epsilon-asi/apps';

const threadPaths = crudPaths({ name: 'SalesThread', parent: { name: 'SalesCampaign' } });
// threadPaths.collection is '/sales-campaigns/:salesCampaignId/sales-threads'.
// threadPaths.item is '/sales-campaigns/:salesCampaignId/sales-threads/:salesThreadId'.
```

## CRUD methods and success codes

`CRUD_OPERATIONS` is the shared table of HTTP methods and success codes. Create uses `post` and `201`. Get and List use `get`, Update uses `patch`, and Delete uses `delete`, each with `200`. The table and its entries are frozen and preserve their literal types.

```ts
import { CRUD_OPERATIONS } from '@epsilon-asi/apps';

const createOffering = CRUD_OPERATIONS.Create; // { method: 'post', code: 201 }
const deleteOffering = CRUD_OPERATIONS.Delete; // { method: 'delete', code: 200 }
```

## Reserved route names

`assertRouteNamesAvailable()` checks a declared path, a transition verb, or both. It throws a `TypeError` when a whole static path segment or verb is `bulk` or `restore`, in any letter case. Longer names such as `bulkhead` and parameter names such as `:bulk` are available.

```ts
import { assertOptionNamesAvailable, assertRouteNamesAvailable } from '@epsilon-asi/apps';

assertRouteNamesAvailable({ path: '/offerings/:offeringId/archive', verb: 'archive' });
assertOptionNamesAvailable({ name: 'Offering' });
```

`assertOptionNamesAvailable()` throws a `TypeError` if a declaration has an own option named `softDelete`, `versioned`, `deprecated`, `suspended` or `impersonation`, even when its value is `false` or `undefined`. It checks the declaration’s top-level keys, so a resource field can still use one of those names.

## Pagination defaults

Import `DEFAULT_PAGE` (`0`) for the first page, `DEFAULT_PER_PAGE` (`20`) for the default page size and `DEFAULT_MAX_PER_PAGE` (`100`) for the default maximum page size from `@epsilon-asi/apps`.

## Sort directions and filter operators

`SortDirection` accepts the literals `'asc'` and `'desc'` as well as the named values `SortDirection.Asc` and `SortDirection.Desc`. `FilterOperator` gives each wire operator a name and is also the union of all its wire literals. `FILTER_OPERATORS` groups those values for text, enums, ranges (numbers, bigints and dates), booleans, IDs and references, and arrays. Each group supplies a corresponding type such as `TextOperator` or `RangeOperator`.

```ts
import {
  FILTER_OPERATORS, FilterOperator, filterOperatorMessageKey, SortDirection, type RangeOperator, type TextOperator,
} from '@epsilon-asi/apps';

const newestFirst: SortDirection = SortDirection.Desc;
const nameFilter: TextOperator = FilterOperator.ILike;
const dateFilter: RangeOperator = FilterOperator.Gte;
const dateOperators = FILTER_OPERATORS.range;
const dateFilterLabel = filterOperatorMessageKey(dateFilter); // 'filters.operator.Gte'
```

`filterOperatorMessageKey()` accepts a named operator or its wire literal. It preserves the spelling used by the translation catalog, so `'$ilike'` yields `'filters.operator.ILike'`.

For a nullable field, `FILTER_OPERATORS.nullable` adds `$exists` and equality with `null` to its base group. For example, a nullable array can be compared with `null` as well as filtered with `$contains` or `$overlap`.

## Search queries

A list that offers search can add an optional `q` field using `searchQuerySchema`. It preserves the input string and caps its length at `DEFAULT_MAX_SEARCH_LENGTH` (200). An overlong query produces a validation issue on `q`.

```ts
import { searchQuerySchema } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const listQuery = z.object({ q: searchQuerySchema.optional() });
const query = listQuery.parse({ q: 'monthly invoices' });
```

## Date wire codec

`dateWireCodec` decodes ISO timestamps with `Z` or an explicit UTC offset and encodes a JavaScript `Date` in UTC with millisecond precision. It rejects invalid dates, timestamps missing a time zone, and instants whose UTC year falls outside 0000–9999.

```ts
import { dateWireCodec } from '@epsilon-asi/apps';

const instant = dateWireCodec.decode('2024-03-01T00:15:20.123+05:30');
const utc = dateWireCodec.encode(instant); // '2024-02-29T18:45:20.123Z'
```

## Number wire codec

`numberWireCodec` decodes strings in JSON number syntax, including fractions and exponents, to finite JavaScript numbers. Empty strings, surrounding whitespace and overflow fail validation. Encoding preserves the numeric value, including negative zero.

```ts
import { numberWireCodec } from '@epsilon-asi/apps';

const zero = numberWireCodec.decode('0');
const amount = numberWireCodec.decode('1.25e1');
const wire = numberWireCodec.encode(amount); // '12.5'
```

## Boolean wire codec

`booleanWireCodec` uses Zod’s case-insensitive `stringbool()` values, including `'true'` and `'false'`, `'1'` and `'0'`, and `'yes'` and `'no'`. It rejects unrecognized strings and encodes each boolean as lowercase `'true'` or `'false'`.

```ts
import { booleanWireCodec } from '@epsilon-asi/apps';

const enabled = booleanWireCodec.decode('YES'); // true
const flag = booleanWireCodec.encode(enabled); // 'true'
```

## Success responses

`SuccessResponse<Data>` describes what a caller receives from an endpoint that declares response data. Its `code` uses the `SUCCESS_CODES` type, the union `200 | 201`. The frozen `SUCCESS_CODES` object gives those values the names `Ok` and `Created`. The `data` property is required even for a nullable payload, and `message` is an optional string.

```ts
import { SUCCESS_CODES, type SuccessResponse } from '@epsilon-asi/apps';

const created: SuccessResponse<{ id: string }> = {
  code: SUCCESS_CODES.Created,
  data: { id: 'offering-17' },
  message: 'offering.created',
};
```

## Validation failures

`ValidationFailureResponse` describes an HTTP 422 response. It requires a namespaced wire error, the request’s `traceId` and an array of issues. Each issue has a flat request field name, a message and a code. Pass the request’s field names as a type argument to catch misspelled paths.

```ts
import type { ValidationFailureResponse } from '@epsilon-asi/apps';

type OfferingRequest = { name: string; price: number };
const invalidOffering: ValidationFailureResponse<keyof OfferingRequest> = {
  code: 422,
  error: 'Offering.INVALID_PRICE',
  traceId: 'request-17',
  issues: [{ path: 'price', message: 'offering.price.minimum', code: 'too_small' }],
};
```

## Authentication failures

`AuthenticationFailureResponse` requires status `401`, the request’s `traceId`, and one of two wire errors. `Auth.TOKEN_EXPIRED` identifies an expired token so a client can decide when to refresh. Other authentication failures use `Auth.UNAUTHENTICATED`.

```ts
import type { AuthenticationFailureResponse } from '@epsilon-asi/apps';

const expired: AuthenticationFailureResponse = {
  code: 401,
  error: 'Auth.TOKEN_EXPIRED',
  traceId: 'request-18',
};
```

## Authorization failures

Use `AuthorizationFailureResponse` for a member who lacks a required role or permission in the current tenant. It carries status `403`, a namespaced wire error and the request’s trace ID. A lookup for a resource in another tenant returns `404`.

```ts
import type { AuthorizationFailureResponse } from '@epsilon-asi/apps';

const forbidden: AuthorizationFailureResponse = {
  code: 403,
  error: 'Offering.PERMISSION_REQUIRED',
  traceId: 'request-19',
};
```

## Not-found responses

`NotFoundFailureResponse` carries status `404`, a namespaced error and the request’s trace ID. The same response describes a missing resource and one outside the caller’s tenant, so callers cannot distinguish those cases.

```ts
import type { NotFoundFailureResponse } from '@epsilon-asi/apps';

const missingOffering: NotFoundFailureResponse = {
  code: 404,
  error: 'Offering.NOT_FOUND',
  traceId: 'request-20',
};
```

## Domain error translation keys

`domainErrorMessageKey()` prefixes a namespaced wire error with `errors.` and preserves the spelling of both the domain and the error code.

```ts
import { domainErrorMessageKey } from '@epsilon-asi/apps';

const billingMessage = domainErrorMessageKey('OrgBilling.UNPAID'); // 'errors.OrgBilling.UNPAID'
```

## Verification

Run `corepack pnpm --filter @epsilon-asi/apps run verify` from the repository root after the workspace build. It typechecks source and tests, runs Vitest, rebuilds the ESM package, checks the browser bundle and imports the built entry in Node.

Vitest uses the `standardDecorators()` plugin from `@epsilon-asi/command-line/vitest`. The test decorates a class and a field, then reads both metadata records through foundation's registry.

The SQLite test opens `:memory:` through `@mikro-orm/sqlite`, executes a query and closes the connection. Run `corepack pnpm --filter @epsilon-asi/apps test` using the same Node major as the workspace install so the native `better-sqlite3` binding matches.

After the workspace build, run `corepack pnpm --filter @epsilon-asi/apps run check:browser` for the browser check alone. It rebuilds the package and bundles a consumer that re-exports both the apps and foundation roots. The check rejects external imports, Node built-ins and server-only dependencies in the bundle. It also typechecks the consumer against the shipped declarations with DOM libraries and ambient Node types disabled. CI runs the type checks on TypeScript 5.9 and 7.

### Resource framework spikes

The fixtures under `tests/spikes/` exercise planned resource contracts using the workspace packages. Run them from the repository root after the workspace build.

```sh
corepack pnpm --filter @epsilon-asi/apps run typecheck
node node_modules/typescript/bin/tsc -p packages/apps/tsconfig.type-tests.json
corepack pnpm --filter @epsilon-asi/apps exec vitest run tests/spikes
```

The first two commands check the fixtures on TypeScript 7.0.2 and 5.9.3 respectively. The third runs the runtime examples, including a forked HTTP server on loopback and an in-memory SQLite database. To include PostgreSQL, point `SPIKE_POSTGRES_URL` at a local test database where the test user can create a schema. The fixture creates a uniquely named schema and drops it on completion. The following command requires the PostgreSQL case to run.

```sh
export SPIKE_POSTGRES_URL='postgresql://localhost:5432/foundations_spike'
SPIKE_REQUIRE_POSTGRES=1 corepack pnpm --filter @epsilon-asi/apps exec vitest run tests/spikes
```

- **S0, route typing.** A decorated routes class uses command-line’s middleware types and a minimal endpoint contract. Its handlers infer the request and the fields supplied by group and route middleware. Expected compiler errors cover invalid returns, missing route context and bad endpoint references. Replace the endpoint stub when Phase 1.4 ships.
- **S1, PATCH and projection.** Create applies defaults. PATCH preserves omitted fields, and both write schemas reject forbidden fields in nested resources. The read schema strips hidden data from responses and messages. The foundation logger receives a raw row and omits hidden names discovered from the same field metadata. Redaction applies a matching name throughout the log record.
- **S3, MikroORM.** SQLite and PostgreSQL share the create, assign, serialize, nested query and tenant-filter cases. The PostgreSQL fixture also verifies JSONB object containment and overlap on string and numeric arrays. It implements overlap as an OR of singleton `$contains` predicates.
- **S4, tenancy and access.** Six declarations drive one in-memory store. Tests exercise tenant, parent and user boundaries, entitlement-gated shared rows, and account rows outside tenant scope. The UI predicate and server operation are each checked against the same expected outcomes.
- **S5, graceful shutdown.** An Express 5 child process fails readiness, refuses new connections and finishes work on a reused socket. It closes idle sockets again as responses finish. A second case keeps a request open until the deadline and verifies that the client is disconnected and the process exits.
- **S6, resource inheritance.** `Organization extends TenantResource` inherits field schemas, access options and derived types. The fixture captures each reusable base’s original field types so TypeScript can reject an erased `declare` override. It also checks decorated overrides against the parent’s metadata when the class is defined.
