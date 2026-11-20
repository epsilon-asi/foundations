# @epsilon-asi/apps

The browser-safe package root exports resource model types, the `newId()` UUID generator, and CRUD, HTTP and UI metadata. It derives CRUD endpoint names and paths, tenant names and translation keys. It also provides CRUD methods and success codes, typed success and failure responses, list query primitives, and date, number and boolean wire codecs. [Resource framework plan](https://github.com/epsilon-asi/foundations/blob/main/docs/plans/resource-framework.md)

All five Offering operations run through the typed client over real HTTP on memory and PostgreSQL. The ORM adapter supplies the Get handler. The example supplies Create, Update, Delete and List. [Weekly handoff](../../docs/plans/resource-framework.md#weekly-handoff) · [End-to-end checkpoints](../../docs/plans/resource-framework-e2e.md#implementation-order-and-acceptance)

The [naming guide](docs/CONVENTIONS.md) covers the planned file names, exports and discovery rules for application code. It ships with the package.

The root depends on foundation and Zod. The Node-only `/express` and `/testing` entries use the Express 5 optional peer. The `/runtime` entry owns the HTTP listener and its drain. Redis and Google Cloud Pub/Sub are optional peers for planned adapters. The planned billing adapter declares `stripe` (`^23.1.0`) as an optional peer. The Node-only `/mikro-orm` entry uses the `@mikro-orm/core` optional peer. Applications supply their database driver. The workspace uses the PostgreSQL and SQLite drivers for tests. The migrations peer is reserved for the planned migration tooling. An empty project can install and import the packed root with just foundation and Zod.

## Creating an offering through the typed client

The [Offering example](examples/crud-api/common/src/resources/Offering.ts) declares its fields once. Its [application resource system](examples/crud-api/common/src/app.ts) supplies the tenant and ordered roles. The example enables all five CRUD operations. Each contract derives its flat request, wire sections, success envelope and declared failures.

Call `createClient({ baseUrl, tenant, tokens, fetch }).call(CreateOffering, input)`. The example input contains `name`, `description` and `type`. The caller may omit `links`, and the decoded request supplies an empty array. The client reads the tenant and access token for each call. For Offering, it sends `POST /offerings` with `X-Organization-Id` and a bearer token. On success, `result.code === 201` narrows `result.data` to the readable offering, including decoded `Date` timestamps. A declared 422 resolves with its field issues. A rejected fetch rejects the call.

The [public-consumer test](tests/e2e/createOffering.test.ts) injects fetch and inspects both sides. It decodes the posted body, encodes a row containing a server-only field, checks the outgoing response JSON, and checks what the typed caller receives. Run it from the repository root after installing workspace dependencies:

```sh
corepack pnpm --filter @epsilon-asi/apps... run build
corepack pnpm --filter @epsilon-asi/apps exec vitest run tests/e2e/createOffering.test.ts
```

### Calling the listening example

Install the Express 5 peer for the server. TypeScript consumers of the Node adapter also use the Node and Express 5 type declarations. The [API entry](examples/crud-api/api/src/main.ts) imports the common contract and calls `runApi` with its resource system, token verifiers and membership lookup. At startup the adapter discovers [OfferingRoutes](examples/crud-api/api/src/routes/OfferingRoutes.ts) beside the entry, checks the handlers against the enabled endpoints by identity, then opens the listener. Passing `routes: [OfferingRoutes]` selects the class explicitly. The default address is loopback port 3000. Pass `port: 0` to receive a free port in `api.url` and call `await api.close()` to drain the listener.

For the tenant-owned Offering endpoints, a verifier resolves the bearer token to a user. The server checks the current membership for that user and the selected tenant on every request. The handlers receive the organization through `ctx.tenant.id`. A missing or invalid bearer yields 401, a missing tenant header yields 400, a tenant without a matching membership yields 404, and a member below the declared role receives 403. An authorized caller with invalid fields receives 422 with flat issue paths.

The test kit starts the same API on loopback port zero. Use `createTestApp({ resources, routes: [OfferingRoutes], env: { APP_ENV: 'test' } })`, then call `app.as({ user, tenant, role: 'EDITOR' }).call(CreateOffering, input)`. Each app owns its test tokens and memberships. The API rejects test verifiers unless `APP_ENV` is explicitly `test`. Call `await app.close()` in teardown. [HTTP tests](tests/e2e/createOfferingHttp.test.ts)

### Reading a stored offering

After Create returns 201, pass its ID to `viewer.call(GetOffering, { id: created.data.id })`. The client sends a bodyless `GET /offerings/:offeringId` with the viewer’s bearer and tenant headers. The server maps the path parameter back to `id` using the resource’s primary-key declaration. HTTP 200 returns the same readable fields as Create, including timestamps decoded as `Date` values.

By default the example stores rows in memory for the lifetime of one app. Get, Update and Delete select rows by the authenticated organization and offering ID. A viewer in tenant B receives the same `404 Resource.NOT_FOUND` envelope for tenant A’s ID and a missing ID, with a trace ID for each request. A second app starts with an empty store even when it serves the same organization. [Tenant-isolation tests](tests/e2e/getOfferingHttp.test.ts)

The PostgreSQL routes class declares `@Routes({ defaults: crudHandlers(Offering) })`. Its Get handler calls `get({ ctx, id })` on an instance of `ResourceService(Offering)`. The service reads the primary key and tenant field from the resource declaration and uses the request’s tenant-bound entity manager. It returns a managed entity or `null`. The handler maps `null` to 404, and the HTTP pipeline projects a found entity through the readable schema. Create, Update, Delete and List still have explicit handlers. [Database routes](examples/crud-api/api/src/database.ts) · [Service implementation](src/mikro-orm/resourceService.ts)

Server code can reuse the lookup in a service of its own:

```ts
import { ResourceService } from '@epsilon-asi/apps/mikro-orm';
import { Offering } from './common/src/resources/Offering.js';

class Offerings extends ResourceService(Offering) {}
const offerings = new Offerings();

// Inside a tenant-bound unit of work
const row = await offerings.get({ ctx, id });
```

Run the socket and emitted-discovery tests from the repository root:

```sh
corepack pnpm --filter @epsilon-asi/apps... run build
corepack pnpm --filter @epsilon-asi/apps exec vitest run tests/e2e
```

### Updating an offering

An editor calls `client.call(UpdateOffering, { id, name: 'Professional' })`. The client sends `PATCH /offerings/:offeringId` with the JSON body `{ "name": "Professional" }`. HTTP 200 returns the full readable offering. A viewer in the same tenant can read that version immediately with `GetOffering`.

Only `name`, `description` and `links` are writable on Update. Omitted fields retain their stored values, including nonempty links. Supplying `links` replaces the array, and sending only the ID is a no-op. The example preserves its timestamps during PATCH. Supplying the ID again in the body, a create-only field such as `type`, or a server-owned field produces a 422 identifying the field. A viewer’s update receives 403. Another tenant’s editor receives the same public 404 for a foreign ID and a missing ID. [HTTP acceptance scenario](tests/e2e/offeringUpdate.fixture.ts)

### Deleting an offering

A tenant administrator calls `client.call(DeleteOffering, { id })`. The client sends a bodyless `DELETE /offerings/:offeringId`. A successful delete removes the row and returns HTTP 200 with exactly `{ "code": 200 }`. A subsequent Get or Delete returns `404 Resource.NOT_FOUND`.

The Offering declaration grants Delete to `ADMINISTRATOR` and higher. An editor can create and update an offering but receives 403 on Delete. An administrator from a different tenant receives the same public 404 for that ID and a missing ID. Concurrent authorized deletes of one row yield one success and one 404. [Shared HTTP acceptance test](tests/e2e/offeringDelete.fixture.ts) · [PostgreSQL test](tests/e2e/postgresOfferingHttp.test.ts)

### Listing offerings

A viewer can call `client.call(ListOfferings, { page: 1, perPage: 1 })` to get the second offering in their organization. The client sends a bodyless `GET /offerings?page=1&perPage=1` with the viewer’s credentials and tenant header. Passing `{}` uses page 0 and a page size of 20. The maximum page size is 100.

On HTTP 200, `result.data.offerings` contains the readable rows for that page, ordered by ascending ID by default, and `result.data.count` is the number of rows in the selected tenant that match the filter across all pages. A page beyond the last row returns an empty array with the same total. A tenant with no offerings receives `{ code: 200, data: { offerings: [], count: 0 } }`. Each returned row uses the same projection and date decoding as Get. [Shared HTTP acceptance test](tests/e2e/offeringList.fixture.ts)

The Offering declaration allows equality on `type` and sorting by `name` and `createdAt`. To order service offerings by name, newest first within each name, pass both keys in priority order.

```ts
const page = await viewer.call(ListOfferings, {
  where: { type: { $eq: OfferingType.Service } },
  orderBy: { name: 'asc', createdAt: 'desc' },
  perPage: 1,
});
```

The client encodes `where[type][$eq]=SERVICE`, `orderBy[name]=asc` and `orderBy[createdAt]=desc` in the URL. Both stores filter before counting and paging. They order names by UTF-8 byte value and use ascending ID to break remaining ties. The server returns 422 for an undeclared filter, operator or sort field. [Offering declaration](examples/crud-api/common/src/resources/Offering.ts) · [HTTP scenario](tests/e2e/offeringList.fixture.ts)

The memory store pages the authenticated organization’s entries. PostgreSQL applies the entity’s tenant filter to both the filtered count and the page query in one read-only, repeatable-read transaction. [Database binding](examples/crud-api/api/src/database.ts) · [PostgreSQL acceptance test](tests/e2e/postgresOfferingHttp.test.ts)

### Persisting offerings in PostgreSQL

Install matching versions of `@mikro-orm/core` and `@mikro-orm/postgresql` in the API. The example derives `OfferingEntity` from the common `Offering` class with `defineEntity(Offering)`. Register that entity when initializing MikroORM, then pass the pool to the example. The host supplies the database URL and authentication configuration. [Example database binding](examples/crud-api/api/src/database.ts)

```ts
import { MikroORM } from '@mikro-orm/postgresql';
import { OfferingEntity, offeringDatabase } from './api/src/database.js';
import { startOfferingApi } from './api/src/main.js';

const orm = await MikroORM.init({ clientUrl, entities: [OfferingEntity] });
const api = await startOfferingApi({ verifiers, membership, ...offeringDatabase(orm) });
```

Provision the table before starting the API. During shutdown, drain the listener with `await api.close()`, then release the host’s pool with `await orm.close()`. After authentication, membership and input checks, each request gets a fresh entity manager bound to the verified tenant. Create takes ownership from that context and commits after the handler’s result passes response projection. Update locks the matching row in its write transaction and assigns the validated patch. Concurrent updates to different fields both survive. Delete uses a single tenant-filtered SQL delete in the request transaction. Its affected-row count determines whether the handler succeeds or returns 404. A query on a fresh, unbound manager fails. [Unit of work](src/mikro-orm/unitOfWork.ts) · [Transaction rollback tests](tests/mikro-orm/unitOfWork.test.ts)

To run the PostgreSQL checkpoint locally, set `SPIKE_POSTGRES_URL` to a test database where the user can create schemas, then run the following from the repository root. The test starts two HTTP servers with independent database pools, creates a unique schema and drops it during teardown. The dedicated CI job sets `SPIKE_REQUIRE_POSTGRES=1` so a missing connection fails the check. [PostgreSQL acceptance test](tests/e2e/postgresOfferingHttp.test.ts)

```sh
corepack pnpm --filter @epsilon-asi/apps... run build
SPIKE_REQUIRE_POSTGRES=1 corepack pnpm --filter @epsilon-asi/apps exec vitest run tests/e2e/postgresOfferingHttp.test.ts
```

## Resource model primitives

Field types declare which operations may use a value. They accept ordinary values and preserve `null` and `undefined` in unions. The resource system derives Create and Update validation and read projection from the corresponding field metadata.

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

`Internal<T>` makes the default server-only intent explicit. `Secret<T>` marks sensitive values for redaction and for the encryption planned in Phase 3.7.

`newId()` uses Web Crypto to generate a UUIDv7. IDs from different milliseconds sort by timestamp. IDs from the same millisecond have 74 random bits. [UUIDv7 format](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.7)

Register `crudExtension`, `httpExtension` and `uiExtension` with a foundation type registry to record field and model metadata. Use a CRUD preset string when access is all you need. The presets are `readable`, `editable`, `createOnly`, `updateOnly`, `writeOnly`, `id`, `tenant`, `internal` and `secret`.

The CRUD object form accepts `access`, a boolean `id` flag and `patch`. All three keys are optional. The planned update behavior defaults to `replace`, with `merge` for objects and `append` for arrays. The registry preserves omitted options.

```ts
import {
  crudExtension, fieldMessageKeys, httpExtension, selectOperationFields, uiExtension, type CreateInput,
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
const writableOnUpdate = selectOperationFields({ fields, operation: 'update' });
// [...writableOnUpdate.keys()] is ['tags']. externalId is writable only on create.
const externalId = fields.get('externalId')!;
const keys = fieldMessageKeys({ resource: name, field: externalId.name, ui: externalId.extensions.ui });
// keys.label is 'contact.externalId', keys.placeholder is 'integrations.idPrompt',
// and keys.helperText is 'contact.externalId.helper'.
// fields.get('externalId')?.extensions.http?.name is 'external_id'.
// fields.get('tags')?.extensions.crud is { access: 'editable', patch: 'append' }.
```

`selectOperationFields()` returns the resolved fields for `read`, `create`, or `update` in declaration order, with their schemas and metadata. A `writeOnly` password appears in both write operations. Reads exclude it. An unmarked field is excluded from all three. The `id` and `patch` option flags and schema defaults do not grant access on their own.

The HTTP wire name leaves the class and schema property name intact. Each endpoint will choose where it sends the field.

`uiExtension` stores optional `label` and `plural` message keys on the model. Each field can supply `label`, `placeholder` and `helperText` message keys, string `input` and `autoComplete` hints, a boolean `multiline` flag and numeric `order`. The registry preserves omitted hints. `fieldMessageKeys()` camel-cases the resource name and uses the model field name to derive each missing key. An explicit label, placeholder or helper text overrides only its own key. Declaring `name: 'Contact'` keeps those keys stable when a bundler renames the class.

`Defaulted<T>` marks a schema-supplied default and preserves the wrapped type's read and write permissions. In the example, the Zod schema supplies an empty array when the input omits `tags`.

## Resource field paths

`Paths<C>` describes data-field names on a resource and its nested models, including inherited fields. Paths can contain up to three field names. A recursive resource can therefore name its manager’s manager without making TypeScript follow the relationship indefinitely. Arrays, dates and dictionaries with arbitrary keys end a path. Access rules and list declarations determine which of these paths a caller can actually use.

```ts
import type { Paths, Readable } from '@epsilon-asi/apps';

class PersonRecord {
  name!: Readable<string>;
}
class Employee extends PersonRecord {
  manager?: Readable<Employee>;
}

const managerName: Paths<typeof Employee> = 'manager.name';
const seniorManagerName: Paths<Employee> = 'manager.manager.name';
```

## Server-only fields and log redaction

`serverOnlyFields()` lists the names of unmarked, internal, write-only and secret fields on a resolved model, including inherited fields. It uses the same read-access rules as response projection. Pass the set to the foundation logger to omit those names anywhere in a structured record.

```ts
import { crudExtension, serverOnlyFields, type Editable, type WriteOnly } from '@epsilon-asi/apps';
import { createLogger, createTypeRegistry, type LogRecord } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Contact {
  @Prop.string({ crud: 'editable' }) name!: Editable<string>;
  @Prop.string({ crud: 'writeOnly' }) password!: WriteOnly<string>;
  @Prop.string() importNote!: string;
}

const hidden = serverOnlyFields(resolve(Contact)); // 'password' and 'importNote'
const records: LogRecord[] = [];
const logger = createLogger({
  redaction: { shouldRedact: name => hidden.has(name) },
  write: record => records.push(record),
});
logger.info('contact updated', { name: 'Lee', importNote: 'batch 7' });
// records[0].fields is { name: 'Lee' }.
```

For a record that contains several resource types, collect the names from each reachable model. The [derivation fixture](tests/spikes/derivation/variants.ts) does this for nested and recursive references.

## CRUD primary keys

Pass a resolved model to `crudRouteMetadata()` to validate its primary key when any CRUD operation is enabled. `resolveCrudIdField()` returns the original field, including its schema and extension metadata. It recognizes an inherited ID, the `id` access preset in either declaration form, and the `id: true` flag. A missing or duplicate ID raises `ResourceDefinitionError`, as does marking an `internal` or `secret` field as the ID.

```ts
import {
  crudExtension, crudRouteMetadata, newId, reassembleUpdateRequest, resolveCrudIdField, splitUpdateRequest,
  type Editable, type Id,
} from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class StoredRecord {
  @Prop.uuid({ crud: 'id' }) key!: Id<string>;
}
class CatalogItem extends StoredRecord {
  @Prop.string({ crud: 'editable' }) title!: Editable<string>;
}

const catalogItem = resolve(CatalogItem);
const idField = resolveCrudIdField(catalogItem); // idField.name is 'key'
const catalogRoutes = crudRouteMetadata(catalogItem);
const update = catalogRoutes.find(route => route.operation === 'Update')!;
const key = newId();
const parts = splitUpdateRequest({ ...update, request: { key, title: 'Revised' } });
// parts.params is { catalogItemId: key }. parts.body is { title: 'Revised' }.
const flat = reassembleUpdateRequest({ ...update, ...parts }); // { key, title: 'Revised' }
```

Get, Update and Delete routes on an ordinary resource carry the mapping from the item parameter to the model’s ID field. Pass the route to the request helpers to reuse that mapping in both directions.

## Create path parameters and body

`splitCreateRequest()` puts a collection route’s parent ID in `params` and the remaining create fields in `body`. On a top-level collection the whole request goes in the body. Use `reassembleCreateRequest()` after decoding to recover the flat fields.

```ts
import { crudRouteMetadata, reassembleCreateRequest, splitCreateRequest } from '@epsilon-asi/apps';

const chapters = crudRouteMetadata({ name: 'Chapter', parent: { name: 'Book' } });
const createChapter = chapters.find(route => route.operation === 'Create')!;
const draft = { bookId: 'b7', title: 'Introduction' };
const createContent = splitCreateRequest({ ...createChapter, request: draft });
// { params: { bookId: 'b7' }, body: { title: 'Introduction' } }
const restoredDraft = reassembleCreateRequest({ ...createChapter, ...createContent });
```

### Binding a Create request

Use `bindCreateRequest()` when both the client and handler use the same Create route. Declare the codecs once on the flat request. `toContent()` puts the parent field in `params` and encodes the body. `fromContent()` validates the four wire sections and restores the decoded request.

```ts
import { bindCreateRequest, crudRouteMetadata, dateWireCodec } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const routes = crudRouteMetadata({ name: 'Chapter', parent: { name: 'Book' } });
const route = routes.find(r => r.operation === 'Create')!;
const boundChapter = bindCreateRequest({
  route, request: z.strictObject({ bookId: z.string(), publishedAt: dateWireCodec }),
});
const draft = { bookId: 'b7', publishedAt: new Date('2026-11-19T09:00:00Z') };
const wire = boundChapter.toContent(draft);
// { params: { bookId: 'b7' }, query: {}, body: { publishedAt: '2026-11-19T09:00:00.000Z' }, headers: {} }
const restored = boundChapter.fromContent(wire); // restored.publishedAt is a Date
```

`RequestContent` validates field placement and codecs. A refinement that compares a parent field with a body field belongs on the flat `Request` schema and runs in both conversion methods.

## Get and Delete path parameters

`splitItemRequest()` puts the parent and item IDs in `params` and returns an empty body. After decoding the parameters, `reassembleItemRequest()` restores the flat request. Both helpers use the same mapping as Update. A Get or Delete request can contain only its path fields. On the tenant’s own route, the tenant comes from the header and the flat request is empty.

```ts
import { crudExtension, crudRouteMetadata, reassembleItemRequest, splitItemRequest, type Id } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Chapter {
  @Prop.string({ crud: 'id' }) key!: Id<string>;
}
const chapters = crudRouteMetadata({ ...resolve(Chapter), parent: { name: 'Book' } });
const getChapter = chapters.find(route => route.operation === 'Get')!;
const deleteChapter = chapters.find(route => route.operation === 'Delete')!;
const chapterContent = splitItemRequest({ ...getChapter, request: { bookId: 'b7', key: 'c2' } });
// { params: { bookId: 'b7', chapterId: 'c2' }, body: {} }
const chapterToDelete = reassembleItemRequest({ ...deleteChapter, ...chapterContent });
// { bookId: 'b7', key: 'c2' }
```

### Binding a Get or Delete request

`bindItemRequest()` checks the flat request against the selected item route and encodes its fields in `params`. The other three sections accept empty objects. On a tenant's own route, the flat request is also empty.

```ts
import { bindItemRequest, crudRouteMetadata } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const routes = crudRouteMetadata({ name: 'Chapter', parent: { name: 'Book' } });
const route = routes.find(r => r.operation === 'Get')!;
const chapterItem = bindItemRequest({
  route: { ...route, paramFields: { chapterId: 'key' } },
  request: z.strictObject({ bookId: z.string(), key: z.string() }),
});
const wire = chapterItem.toContent({ bookId: 'b7', key: 'c2' });
const chapter = chapterItem.fromContent(wire); // { bookId: 'b7', key: 'c2' }
```

## Tenant fields on owned resources

When deriving routes with `tenancy: 'owned'`, the resolved model must have exactly one field with the `tenant` access preset. An inherited tenant field counts. `resolveTenantField()` returns the field with its schema and metadata. A missing or duplicate tenant field raises `ResourceDefinitionError` even when all CRUD operations are disabled.

```ts
import { crudExtension, crudRouteMetadata, resolveTenantField, type Id, type Tenant } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class TenantRecord {
  @Prop.uuid({ crud: 'tenant' }) organizationId!: Tenant<string>;
}
class Invoice extends TenantRecord {
  @Prop.uuid({ crud: 'id' }) id!: Id<string>;
}

const invoice = resolve(Invoice);
const ownerField = resolveTenantField(invoice); // ownerField.name is 'organizationId'
const invoiceRoutes = crudRouteMetadata({ ...invoice, tenancy: 'owned' });
```

## Owners of account resources

Set `owner` to the field that identifies the user who owns an account resource. When given a resolved account model, `crudRouteMetadata()` checks the declaration even when all operations are disabled. An inherited field is valid. A missing owner or an unknown field name raises `ResourceDefinitionError`.

```ts
import { crudExtension, crudRouteMetadata, type Id } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class AccountRecord {
  @Prop.uuid() userId!: string;
}
class MfaFactor extends AccountRecord {
  @Prop.uuid({ crud: 'id' }) id!: Id<string>;
}

const factor = resolve(MfaFactor);
const factorRoutes = crudRouteMetadata({ ...factor, tenancy: 'account', owner: 'userId' });
```

Use `assertResourceOwner({ ...factor, tenancy: 'account', owner: 'userId' })` to run this check directly.

## Picking and omitting fields

Use the decorating registry’s `fields(Resource, { pick })` or `fields(Resource, { omit })` to build a strict Zod object for an action request. Field names include inherited declarations. Selected fields keep their validators, defaults and optionality. If a model is already resolved, the package-root `fields(model, options)` takes the same selection.

```ts
import { fields as modelFields } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, fields, resolve } = createTypeRegistry();
class ContactRecord {
  @Prop.email() email!: string;
}
class Contact extends ContactRecord {
  @Prop.string({ optional: true }) displayName?: string;
  @Prop.uuid() id!: string;
}

const changeEmail = fields(Contact, { pick: ['email'] });
const editContact = modelFields(resolve(Contact), { omit: ['id'] });
const emailRequest = changeEmail.parse({ email: 'lee@example.com' });
const profileRequest = editContact.parse({ email: 'lee@example.com', displayName: 'Lee' });
```

## PATCH field schemas

Use `updateFieldSchema({ schema })` when adding a writable field to a PATCH object. It removes the field’s `default`, `prefault`, and `catch` fallbacks and makes the field optional. Omitted fields stay absent. Supplied values still pass through the field’s validation.

```ts
import { updateFieldSchema } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const rank = z.int().positive().catch(1);
const updateOffering = z.object({ rank: updateFieldSchema({ schema: rank }) });
const emptyPatch = updateOffering.parse({}); // {}
const ranked = updateOffering.parse({ rank: 3 }); // { rank: 3 }
const invalidRank = updateOffering.safeParse({ rank: 0 }); // success is false
```

## PATCH modes

A field uses `replace` by default. Declare `merge` on an object or record and `append` on an array or tuple. The CRUD extension checks the decoded value’s shape when the registry resolves the model, including inherited fields. An incompatible declaration raises `ResourceDefinitionError` with the resource, field and mode. The persistence adapter will apply these modes when it handles updates in Phase 3.

```ts
import { crudExtension } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Profile {
  @Prop.string({ crud: 'editable' }) name!: string;
  @Prop(z.object({ city: z.string() }), { crud: { access: 'editable', patch: 'merge' } })
  address!: { city: string };
  @Prop(z.array(z.string()), { crud: { access: 'editable', patch: 'append' } })
  tags!: string[];
}

const profileModel = resolve(Profile);
```

## Enum option labels

`enumOptionMessageKey()` appends the stored enum value to the resource and field names. String values keep their casing. Numeric enums use their stored number, so a value of `0` gives a key ending in `.0`.

```ts
import { enumOptionMessageKey } from '@epsilon-asi/apps';

const draftLabel = enumOptionMessageKey({ resource: 'Offering', field: 'status', value: 'DRAFT' });
// 'offering.status.DRAFT'
```

## Resource translation keys

Pass a resolved resource to `messageKeys()` to check its catalog. The frozen list starts with any explicit resource label and plural. It includes field labels, placeholders and helper text for readable or writable fields, plus labels for each enum value. An inherited field uses the resolved resource’s name. Set `@Type({ name })` explicitly when these keys are shared with a catalog so bundlers can rename the class without changing its translations. Explicit keys take precedence, and repeated keys appear once.

```ts
import { crudExtension, messageKeys, uiExtension } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Type, Prop, resolve } = createTypeRegistry().use(crudExtension).use(uiExtension);
class NamedRecord {
  @Prop.string({ crud: 'editable', ui: { label: 'shared.name' } }) name!: string;
}
@Type({ name: 'Team', ui: { label: 'team.label', plural: 'team.plural' } })
class Team extends NamedRecord {}

const teamKeys = messageKeys(resolve(Team));
const english = {
  'team.label': 'Team',
  'team.plural': 'Teams',
  'shared.name': 'Name',
  'team.name.placeholder': 'Enter a team name',
  'team.name.helper': 'Visible to team members',
};
const missingTeamKeys = teamKeys.filter(key => !Object.hasOwn(english, key)); // []
```

## Tenant names

`tenantNames()` takes the declared singular resource name. For `Organization`, it derives the header `X-Organization-Id`, the request context key `organization` and the model field `organizationId`. Each name can be overridden independently.

```ts
import { tenantNames } from '@epsilon-asi/apps';

const names = tenantNames({ resource: 'Organization', header: 'X-Tenant-Id' });
// { header: 'X-Tenant-Id', context: 'organization', field: 'organizationId' }
```

## API version dates

Use `apiVersionSchema` for an optional `apiVersion` declaration. It accepts a calendar date in `YYYY-MM-DD` form, preserves the string, and leaves an omitted version unset.

```ts
import { apiVersionSchema } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const versionOptions = z.object({ apiVersion: apiVersionSchema });
const unversioned = versionOptions.parse({}); // {}
const versioned = versionOptions.parse({ apiVersion: '2026-11-16' });
const invalidDate = versionOptions.safeParse({ apiVersion: '2026-02-30' }); // success is false
```

## Client API version header

`apiVersionHeaders()` uses the client’s explicit `version` first, then the contract’s `apiVersion`. When both are absent, it returns an empty headers object.

```ts
import { apiVersionHeaders } from '@epsilon-asi/apps';

const contract = { apiVersion: '2026-11-16' };
const defaultHeaders = apiVersionHeaders(contract); // { 'X-Api-Version': '2026-11-16' }
const overrideHeaders = apiVersionHeaders({ ...contract, version: '2024-02-29' });
// { 'X-Api-Version': '2024-02-29' }
const unversionedHeaders = apiVersionHeaders(); // {}
```

## Client tenant header

Call `tenantHeaders()` when building each request. Pass the header name from `tenantNames()` and the client’s callback for the current tenant ID. Each call returns a fresh headers object.

```ts
import { tenantHeaders, tenantNames } from '@epsilon-asi/apps';

const { header } = tenantNames({ resource: 'Organization', header: 'X-Tenant-Id' });
let currentTenant: string | undefined = 'org-a';
const tenantOptions = { header, tenant: () => currentTenant };
const firstTenant = tenantHeaders(tenantOptions); // { 'X-Tenant-Id': 'org-a' }
currentTenant = 'org-b';
const secondTenant = tenantHeaders(tenantOptions); // { 'X-Tenant-Id': 'org-b' }
currentTenant = undefined;
const noTenant = tenantHeaders(tenantOptions); // {}
```

## Endpoint scopes

`endpointScopeSchema` accepts `tenant`, `account` and `public`. An omitted scope defaults to `DEFAULT_ENDPOINT_SCOPE` (`'tenant'`). The reserved value `platform` fails validation. Use the schema on the `scope` property of a declaration.

```ts
import { defaultEndpointScope, EndpointScope, endpointScopeSchema } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const declaration = z.object({ scope: endpointScopeSchema });
const tenantEndpoint = declaration.parse({}); // { scope: 'tenant' }
const accountEndpoint = declaration.parse({ scope: EndpointScope.Account });
const accountDefault = defaultEndpointScope({ tenancy: 'account' }); // 'account'
```

Use `defaultEndpointScope()` when deriving an endpoint from a resource. Account resources default to `account`. Owned, shared, and tenant-self resources, as well as resources with omitted tenancy, default to `tenant`. Public scope requires an explicit declaration.

## Endpoint principals

Tenant routes accept users and API keys by default. Account routes accept users. Public routes allow anonymous callers and omit the `principals` property. A tenant route marked `tool: true` also admits an agent by default. Use `principals` to narrow the allowed kinds for the resource or an individual operation.

When an operation changes to account scope, its inherited restriction keeps only the kinds allowed there. An empty intersection permits no callers. Switching an operation to public scope drops the inherited restriction. Explicitly requiring an authenticated principal on that public operation raises `ApiDefinitionError`.

```ts
import { crudRouteMetadata, resolveEndpointPrincipals } from '@epsilon-asi/apps';

const tenantCallers = resolveEndpointPrincipals({ scope: 'tenant' }); // ['user', 'apiKey']
const accountCallers = resolveEndpointPrincipals({ scope: 'account' }); // ['user']
const documentRoutes = crudRouteMetadata({
  name: 'Document',
  operations: { Delete: { principals: ['user'] }, List: { tool: true } },
});
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

`itemParamName()` returns the name of an item route’s path parameter. Use the singular resource name and write acronyms as words. For example, the helper rejects `APIKey` because its camel-case spelling would disagree with its TypeScript literal type.

`listResponseKey()` returns the property that holds the rows in a list response. It uses the same plural as the list endpoint and converts it to camel case. For example, `ListApiKeys` uses `apiKeys`, and `ListCompanies` uses `companies`.

## Parent-scoped paths

Pass the parent’s singular name and optional plural to prefix both child paths with the parent’s item path. Each ID maps to its own flat request field. The helper rejects a pair that would give both IDs the same field name. The tenant ID travels in the header.

```ts
import { crudPaths } from '@epsilon-asi/apps';

const threadPaths = crudPaths({ name: 'SalesThread', parent: { name: 'SalesCampaign' } });
// threadPaths.collection is '/sales-campaigns/:salesCampaignId/sales-threads'.
// threadPaths.item is '/sales-campaigns/:salesCampaignId/sales-threads/:salesThreadId'.
```

## Path parameters and request fields

Call `assertPathRequestFields()` when defining a route. It checks each path parameter against the top-level fields of the request schema. A missing field raises `ApiDefinitionError` with the route, parameter and expected field name.

```ts
import { assertPathRequestFields } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const reportRequest = z.object({ period: z.string() });
assertPathRequestFields({ path: '/reports/:period', request: reportRequest });
```

Names match by default. If the route uses `:offeringId` and the request declares `id`, pass `paramFields: { offeringId: 'id' }`.

## Request content schemas

`requestContentSchema()` builds the wire contract for `params`, `query`, `body` and `headers`. Declare the schema for each section the endpoint uses. All four sections are required on the wire. An undeclared section accepts only an empty object, and each declared section keeps its codecs.

```ts
import { dateWireCodec, requestContentSchema } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const getChapterContent = requestContentSchema({
  params: z.strictObject({ chapterId: z.string() }),
  query: z.strictObject({ asOf: dateWireCodec.optional() }),
});
const chapterLookup = getChapterContent.decode({
  params: { chapterId: 'c7' }, query: { asOf: '2026-11-19T09:00:00Z' }, body: {}, headers: {},
});
const wireLookup = getChapterContent.encode(chapterLookup);
// chapterLookup.query.asOf is a Date when supplied. wireLookup.query.asOf is an ISO string.
```

## Endpoint request and response types

### Assembling a Create endpoint

`createEndpointContract()` combines the selected route, flat request and readable row schema. The client uses the conversion methods, the handler uses the decoded request and row, and the response union covers the route’s `201` success and its declared or default failures.

```ts
import { createEndpointContract, crudRouteMetadata, dateWireCodec, type RequestOf, type ResponseTypeUnionOf } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const routes = crudRouteMetadata({ name: 'Chapter', parent: { name: 'Book' }, scope: 'account' });
const CreateChapter = createEndpointContract({
  route: routes.find(r => r.operation === 'Create')!,
  request: z.strictObject({ bookId: z.string(), publishedAt: dateWireCodec }),
  row: z.strictObject({ key: z.string(), publishedAt: dateWireCodec }),
});
const draft: RequestOf<typeof CreateChapter> = { bookId: 'b7', publishedAt: new Date('2026-11-19T09:00:00Z') };
const content = CreateChapter.toContent(draft);
const reply: ResponseTypeUnionOf<typeof CreateChapter> = {
  code: 201, data: { key: 'c2', publishedAt: CreateChapter.fromContent(content).publishedAt },
};
```

### Inferring the contract types

`RequestContentOf<E>` gives the wire input for the endpoint’s request sections. `RequestOf<E>` gives the handler its flat, decoded request. On success, `ResponseDataOf<E>` gives the payload and `ResponseOf<E>` gives the decoded envelope, including its status code. A Delete endpoint with `ResponseData: undefined` has a `void` handler result.

```ts
import { dateWireCodec, requestContentSchema, successResponseSchema, type RequestContentOf, type RequestOf, type ResponseDataOf, type ResponseOf } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const request = z.object({ startsAt: dateWireCodec });
const data = z.object({ confirmedAt: dateWireCodec });
export const Reschedule = {
  Request: request,
  RequestContent: requestContentSchema({ body: request }),
  ResponseData: data,
  Response: successResponseSchema({ code: 200, data }),
};
const Cancel = { Request: z.object({ id: z.string() }), ResponseData: undefined };

function reschedule(request: RequestOf<typeof Reschedule>): ResponseDataOf<typeof Reschedule> {
  return { confirmedAt: request.startsAt };
}
function cancel(_request: RequestOf<typeof Cancel>): ResponseDataOf<typeof Cancel> {}

const content: RequestContentOf<typeof Reschedule> = {
  params: {}, query: {}, body: { startsAt: '2026-11-19T09:00:00Z' }, headers: {},
};
const confirmation = reschedule(Reschedule.RequestContent.decode(content).body);
const reply: ResponseOf<typeof Reschedule> = { code: 200, data: confirmation };
// content.body.startsAt is a string. reply.data.confirmedAt is a Date.
```

## List query types

`ListQueryOf<typeof ListChapters>` gives the decoded `query` section. The paging mode and declared list options determine its fields. A parent ID stays in `params`.

```ts
import { cursorListQuerySchema, type ListQueryOf } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const query = cursorListQuerySchema({ search: { fields: ['title'] } });
const empty = z.strictObject({});
export const ListChapters = {
  RequestContent: z.strictObject({ params: z.strictObject({ bookId: z.string() }), query, body: empty, headers: empty }),
};
export type ChapterQuery = ListQueryOf<typeof ListChapters>;
const chapterSearch: ChapterQuery = query.decode({ cursor: 'next', perPage: '5', q: 'history' });
// { cursor: 'next', perPage: 5, q: 'history' }
```

## List path parameters and query

`splitListRequest()` separates a decoded List request into `params` and `query`. The parent ID goes in the path. Paging, filters, sorting and search stay in the query. On a top-level collection, `params` is empty. Pass the same route to `reassembleListRequest()` to recover the flat request.

```ts
import { crudExtension, crudRouteMetadata, cursorListQuerySchema, reassembleListRequest, splitListRequest, type Id, type Readable } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Chapter {
  @Prop.string({ crud: 'id' }) id!: Id<string>;
  @Prop.string({ crud: 'readable' }) title!: Readable<string>;
}
const model = resolve(Chapter);
const filter = { title: ['$eq'] } as const;
const route = crudRouteMetadata({ ...model, parent: { name: 'Book' }, list: { filter } })
  .find(route => route.operation === 'List')!;
const query = cursorListQuerySchema({ model, filter }).decode({
  cursor: 'next', perPage: '5', where: { title: { $eq: 'History' } },
});
const listSections = splitListRequest({ ...route, request: { bookId: 'b7', ...query } });
const restoredList = reassembleListRequest({ ...route, ...listSections });
// listSections.params is { bookId: 'b7' }. Its query retains the cursor, numeric page size and filter.
```

### Binding a List request

Use `bindListRequest()` with the List route and its query schema. The parent identifier travels in `params`. The cursor, filters and paging fields travel in `query`. The bound methods restore the flat request and preserve the query’s codecs and defaults.

```ts
import { bindListRequest, crudExtension, crudRouteMetadata, listQuerySchema, type Readable } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Delivery {
  @Prop.date({ crud: 'readable' }) dueAt!: Readable<Date>;
}
const routes = crudRouteMetadata({ name: 'Delivery', plural: 'Deliveries', parent: { name: 'Depot' }, list: { paging: 'cursor' } });
const boundList = bindListRequest({
  route: routes.find(r => r.operation === 'List')!,
  query: listQuerySchema({ model: resolve(Delivery), paging: 'cursor', filter: { dueAt: ['$gte'] } }),
});
const page = boundList.fromContent({
  params: { depotId: 'd1' }, query: { cursor: 'next', where: { dueAt: { $gte: '2026-11-19T09:00:00Z' } } },
  body: {}, headers: {},
});
const wire = boundList.toContent(page); // page.where?.dueAt?.$gte is a Date
```

## Endpoint response unions

Use `responseTypeUnion({ response, failures })` to build an endpoint's `ResponseTypeUnion` schema. Pass the success envelope and the endpoint's failure codes. A literal list keeps the allowed statuses exact in TypeScript. `ResponseTypeUnionOf<typeof Endpoint>` gives the caller the decoded union. Checking `code` narrows it to the matching response, including the field issues on a 422.

```ts
import { dateWireCodec, responseTypeUnion, successResponseSchema, type ResponseTypeUnionOf } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const success = successResponseSchema({
  code: 200, data: z.strictObject({ publishedAt: dateWireCodec }),
});
export const ReportLookup = {
  Response: success,
  ResponseTypeUnion: responseTypeUnion({ response: success, failures: [404, 422] }),
};

function describeLookup(result: ResponseTypeUnionOf<typeof ReportLookup>): string {
  if (result.code === 200) return result.data.publishedAt.toISOString();
  if (result.code === 422) return result.issues.map(issue => issue.path).join(', ');
  return result.traceId;
}

const lookupResult = ReportLookup.ResponseTypeUnion.decode({
  code: 422, error: 'Request.INVALID', traceId: 'req-9',
  issues: [{ path: 'reportId', message: 'Expected a UUID', code: 'invalid_format' }],
});
const invalidField = describeLookup(lookupResult); // 'reportId'
```

For a computed list, pass `defaultFailureCodes()` or a `readonly FailureStatus[]`. The schema validates the actual codes in the list. Its TypeScript union follows the list’s element type, so a known public scope rules out the default authentication, authorization, session-store and missing-tenant responses. See [Default failure codes](#default-failure-codes).

## Update path parameters and body

`splitUpdateRequest()` separates the path parameters from the body of a flat update request before wire encoding. After decoding the sections, use `reassembleUpdateRequest()` with the same mapping to recover the flat fields.

```ts
import { reassembleUpdateRequest, splitUpdateRequest } from '@epsilon-asi/apps';

const offeringUpdateRoute = {
  path: '/catalogs/:catalogId/offerings/:offeringId',
  paramFields: { offeringId: 'id' },
} as const;
const updateParts = splitUpdateRequest({
  ...offeringUpdateRoute,
  request: { catalogId: 'c', id: 'a', name: 'Acme' },
});
// { params: { catalogId: 'c', offeringId: 'a' }, body: { name: 'Acme' } }
const flatUpdate = reassembleUpdateRequest({ ...offeringUpdateRoute, ...updateParts });
// { catalogId: 'c', id: 'a', name: 'Acme' }
```

An absent required path value raises a `TypeError` naming the route and field. A parameter in an optional path group can be omitted.

During reassembly, a request field assigned to the path must come from `params`. Supplying it in `body` raises an error, even if both values agree.

### Binding an Update request

Bind a generated Update route to the flat field schemas to share the conversion between client and handler. Path fields stay required. PATCH body fields are optional, and omitting a field leaves it absent even if its Create schema has a default.

```ts
import { bindUpdateRequest, crudRouteMetadata } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const routes = crudRouteMetadata({ name: 'Chapter', parent: { name: 'Book' } });
const update = routes.find(route => route.operation === 'Update')!;
const patch = bindUpdateRequest({
  route: { ...update, paramFields: { chapterId: 'key' } },
  request: z.strictObject({ bookId: z.string(), key: z.string(), title: z.string().default('Draft') }),
});
const sections = patch.toContent({ bookId: 'b7', key: 'c2' });
const restored = patch.fromContent(sections);
// sections.params is { bookId: 'b7', chapterId: 'c2' }. The body is empty.
```

## Duplicate routes

Call `assertUniqueRoutes()` on the combined route declarations. Two endpoints claiming the same HTTP method and path raise `ApiDefinitionError`. For example, `GET /reports/:id` and `GET /reports/:period` claim the same route. Different methods can share a path. CRUD and transition descriptors can be passed directly.

```ts
import { assertUniqueRoutes } from '@epsilon-asi/apps';

const reportRoutes = [
  { name: 'ListReports', method: 'get', path: '/reports' },
  { name: 'CreateReport', method: 'post', path: '/reports' },
] as const;
assertUniqueRoutes(reportRoutes);
```

## CRUD methods and success codes

`CRUD_OPERATIONS` is the shared table of HTTP methods and success codes. Create uses `post` and `201`. Get and List use `get`, Update uses `patch`, and Delete uses `delete`, each with `200`. The table and its entries are frozen and preserve their literal types.

```ts
import { CRUD_OPERATIONS } from '@epsilon-asi/apps';

const createOffering = CRUD_OPERATIONS.Create; // { method: 'post', code: 201 }
const deleteOffering = CRUD_OPERATIONS.Delete; // { method: 'delete', code: 200 }
```

## Enabled CRUD operations

`enabledCrudOperations()` returns the enabled names in `CRUD_OPERATIONS` order. Ordinary resources get all five operations. Shared resources start with Get and List. Set an operation to `false` to disable it, or pass `true` or a per-operation settings object to enable it.

```ts
import { enabledCrudOperations } from '@epsilon-asi/apps';

const readOnly = enabledCrudOperations({ tenancy: 'shared' }); // ['Get', 'List']
const editableCatalog = enabledCrudOperations({
  tenancy: 'shared',
  operations: { Update: { principals: ['user'] } },
}); // ['Get', 'Update', 'List']
```

## Shared resource access

Shared resources expose Get and List by default. Give both a rule with `access.read`. A dedicated `list` rule can override it for List. To enable a shared write, turn on the operation and give it a `create`, `update` or `delete` rule, or a common `write` rule. A declaration missing a rule for an enabled operation raises `ApiDefinitionError`.

```ts
import { crudRouteMetadata } from '@epsilon-asi/apps';

const directoryRoutes = crudRouteMetadata({
  name: 'Company', plural: 'Companies', tenancy: 'shared',
  access: { read: 'VIEWER', write: 'ADMINISTRATOR', update: 'EDITOR' },
  operations: { Update: true },
});
const listAccess = directoryRoutes.find(route => route.operation === 'List')?.Access; // 'VIEWER'
const updateAccess = directoryRoutes.find(route => route.operation === 'Update')?.Access; // 'EDITOR'
type DirectoryOperation = (typeof directoryRoutes)[number]['operation']; // 'Get' | 'Update' | 'List'
```

TypeScript derives that operation union from the declaration. Removing the `Update` override makes it `'Get' | 'List'`. If a flag’s value is known only at runtime, its operation stays possible in the type.

The descriptor’s `Access` member carries the selected rule, including a rule object or array. Get uses `read`. List first looks for `list`, then `read`. Create, Update and Delete first look for their own rule, then `write`. An operation with no declared rule omits the member.

## Field write rules

A rule under `access.fields.<field>.write` can restrict a field that an enabled Create or Update operation already accepts. Pass the result of `resolve()` to `crudRouteMetadata()` so TypeScript can check the field name against the model's write grants. Renaming a field then flags the old rule in the declaration. A create-only field can carry a rule when Create is enabled, and an update-only field can carry one when Update is enabled. Inherited grants count. JavaScript callers receive an `ApiDefinitionError` for an unknown or unwritable field when the routes are declared.

```ts
import { crudExtension, crudRouteMetadata, type Editable, type Id, type Readable } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Membership {
  @Prop.uuid({ crud: 'id' }) id!: Id<string>;
  @Prop.string({ crud: 'editable' }) role!: Editable<string>;
  @Prop.string({ crud: 'readable' }) joinedBy!: Readable<string>;
}

const membershipModel = resolve(Membership);
const membershipRoutes = crudRouteMetadata({
  ...membershipModel, access: { fields: { role: { write: 'OWNER' } } },
});
// Putting the same rule on joinedBy would be a type error because it only has a read grant.
```

## Tenant resource paths

`tenantResourcePath()` uses the singular name for the tenant selected by the request header. Pass the declared verb to derive the path for a POST transition. Both paths are static, so neither takes a tenant ID.

```ts
import { tenantResourcePath } from '@epsilon-asi/apps';

const organizationPath = tenantResourcePath({ name: 'Organization' }); // '/organization'
const archivePath = tenantResourcePath({ name: 'Organization', verb: 'archive' }); // '/organization/archive'
```

## CRUD route metadata

`crudRouteMetadata()` returns one descriptor per enabled operation in CRUD order, each with `kind: 'crud'`. Create and List use the collection path. Get, Update, and Delete use the item path. For a tenant resource such as `Organization`, the item path is `/organization` and the collection path is `/organizations`.

Each descriptor’s `docs` flag controls its visibility in OpenAPI. It defaults to `DEFAULT_ENDPOINT_DOCS` (`true`). Set `docs` on the resource declaration to change the default for its operations, or on one operation to override it. A hidden route stays enabled.

Each enabled route also carries its effective `scope`. An operation’s scope takes precedence over the resource setting. When both are omitted, account resources get `account` and other resources get `tenant`. After selecting a route by operation, TypeScript retains its declared scope. Pass the descriptor to `defaultFailureCodes()` to carry that scope into the inferred failure codes.

If the name ends in `s`, `x`, `y`, `ch` or `sh`, this declaration warns once when it uses the default plural. For `Company`, that produces `ListCompanys` and `/companys`. Set `plural: 'Companies'` to get `ListCompanies` and `/companies` without a warning. The `warn` callback defaults to `console.warn`.

```ts
import { crudRouteMetadata, defaultFailureCodes } from '@epsilon-asi/apps';

const offeringRoutes = crudRouteMetadata({
  name: 'Offering',
  docs: false,
  operations: { Create: { docs: true }, Delete: false },
});
const createRoute = offeringRoutes.find(route => route.operation === 'Create');
// CreateOffering uses POST /offerings, returns 201, and appears in OpenAPI.
// It has tenant scope and accepts the user and apiKey principal kinds.

export const eventRoutes = crudRouteMetadata({
  name: 'Event',
  scope: 'account',
  operations: { List: { scope: 'public' } },
});
const listEvents = eventRoutes.find(route => route.operation === 'List')!;
const listingScope: 'public' = listEvents.scope;
const listingFailures = defaultFailureCodes(listEvents); // [422, 429, 500]
```

### Reading endpoint contract members

`endpointRouteContract()` exposes the descriptor as `Route` and its resolved values as `Name`, `Kind`, `Method`, `Path` and `Access`. An endpoint without a declared access rule has `Access: undefined`.

```ts
import { crudRouteMetadata, endpointRouteContract, transitionRouteMetadata } from '@epsilon-asi/apps';

const directory = crudRouteMetadata({ name: 'Person', plural: 'People', tenancy: 'shared', access: { read: 'VIEWER' } });
const getPerson = endpointRouteContract(directory.find(route => route.operation === 'Get')!);
const archivePerson = endpointRouteContract(transitionRouteMetadata({ name: 'Person', plural: 'People', verb: 'archive' }));
// getPerson.Method is 'get' and getPerson.Access is 'VIEWER'. archivePerson.Method is 'post'.
```

## Transition routes

`transitionRouteMetadata()` derives the export name and POST path for one transition. The verb follows the resource’s item path, including its parent when declared. A transition on the tenant itself uses the singular tenant path. A compound verb such as `request-review` keeps its spelling in the URL and becomes `RequestReview` in the export name.

```ts
import { transitionRouteMetadata } from '@epsilon-asi/apps';

const verbOptions = { archive: { principals: ['user'], docs: false } } as const;
const archiveOffering = transitionRouteMetadata({ name: 'Offering', verb: 'archive', options: verbOptions });
const publishOffering = transitionRouteMetadata({ name: 'Offering', verb: 'publish', options: verbOptions });
// ArchiveOffering accepts users at POST /offerings/:offeringId/archive. Its docs flag is false.
// PublishOffering keeps docs: true and the tenant principals, user and apiKey.

const acceptInvitation = transitionRouteMetadata({
  name: 'Invitation', verb: 'accept', options: { accept: { scope: 'account' } },
});
// AcceptInvitation has account scope. A signed-in user can accept before joining the tenant.
```

Use the transition verb as the key in `options`. Each descriptor exposes its effective `scope`. An explicit scope on the selected verb sets its principal defaults. A verb with no scope setting inherits the resource’s tenancy default. Account scope allows users, tenant scope allows users and API keys, and public scope allows anonymous callers. When handling either a CRUD or transition descriptor, check `route.kind` to narrow its TypeScript type. The `crud` branch exposes the selected `operation`.

Every transition also exposes `docs`, which defaults to `true`. Set it to `false` on a verb to hide that route from the OpenAPI document. The verb keeps its route and access settings.

## Default failure codes

`defaultFailureCodes()` returns the distinct HTTP status codes for a declaration in numeric order. Pass its effective scope, path template and optional CRUD operation. The scope defaults to `tenant`. Set `requiresBudget` or `requiresFeature` when a budget check or feature rule applies. Either adds `402`.

```ts
import { defaultFailureCodes } from '@epsilon-asi/apps';

const signInFailures = defaultFailureCodes({ scope: 'public', path: '/sign-in' });
// [422, 429, 500]
type PublicDefault = (typeof signInFailures)[number]; // 422 | 429 | 500
const chapterFailures = defaultFailureCodes({ scope: 'account', path: '/chapters/:chapterId' });
// [401, 403, 404, 422, 429, 500, 503]
const createFailures = defaultFailureCodes({ operation: 'Create', path: '/offerings', requiresBudget: true });
// [400, 401, 402, 403, 404, 409, 422, 429, 500, 503]
```

Passing a known `public` scope excludes `400`, `401`, `403` and `503` from the inferred element type. An `account` scope excludes `400`. On either scope an inferred static path such as `/sign-in` excludes `404`. A declared path parameter or tenant scope includes it. This also applies to generated Create and List routes. A top-level public collection excludes `404`, while a parent-scoped public collection includes it.

If a path is known only as `string`, or a call explicitly supplies only the scope type argument, callers still handle a possible `404`.

TypeScript includes `409` when the operation can be Create, Update or Delete. It includes `402` when `requiresBudget` or `requiresFeature` can be `true`. If a guard flag is known only at runtime, callers handle `402` in the type and the returned array contains it only when the flag is on.

### Overriding endpoint failures

Pass the endpoint declaration to `responseTypeUnion()` to derive its default failures. Supply `failures` to select the entire failure list. An empty list admits success alone.

```ts
import { responseTypeUnion, successResponseSchema } from '@epsilon-asi/apps';

const refresh = { scope: 'public', path: '/sessions/refresh', response: successResponseSchema({ code: 200 }) } as const;
const refreshDefaults = responseTypeUnion(refresh);
const refreshReplies = responseTypeUnion({ ...refresh, failures: [401, 422, 429, 500] });
const expired = refreshReplies.decode({ code: 401, error: 'Auth.TOKEN_EXPIRED', traceId: 'request-7' });
```

## Reserved route names

`assertRouteNamesAvailable()` checks a declared path, a transition verb, or both. It throws a `TypeError` when a whole static path segment or verb is `bulk` or `restore`, in any letter case. Longer names such as `bulkhead` and parameter names such as `:bulk` are available.

```ts
import { assertOptionNamesAvailable, assertRouteNamesAvailable } from '@epsilon-asi/apps';

assertRouteNamesAvailable({ path: '/offerings/:offeringId/archive', verb: 'archive' });
assertOptionNamesAvailable({ name: 'Offering' });
```

`crudRouteMetadata()` checks the resource options and each operation’s settings with `assertOptionNamesAvailable()`. An own option named `softDelete`, `versioned`, `deprecated`, `suspended` or `impersonation` raises a `TypeError`, even when set to `false` or `undefined`. A resource can still have a field named `suspended` and use it in field access rules and list filters.

`transitionRouteMetadata()` checks the transition declaration and the selected verb’s settings the same way. For example, `options: { archive: { versioned: false } }` fails when declaring `archive`. A sibling verb can still be declared. The verb itself can be named `suspended` because that spelling is reserved only as an option key.

## Pagination defaults

Import `DEFAULT_PAGE` (`0`) for the first page, `DEFAULT_PER_PAGE` (`20`) for the default page size and `DEFAULT_MAX_PER_PAGE` (`100`) for the default maximum page size from `@epsilon-asi/apps`.

Pass a list’s `perPage` settings to `offsetPaginationDefaults()` to resolve its first page, page size and maximum. A maximum below 20 also bounds the implicit page size. Declared sizes must be positive safe integers, and an explicit default must fit within the effective maximum.

```ts
import { offsetPaginationDefaults } from '@epsilon-asi/apps';

const standardPaging = offsetPaginationDefaults(); // { page: 0, perPage: 20, maxPerPage: 100 }
const catalogPaging = offsetPaginationDefaults({ perPage: { default: 10, max: 50 } });
// { page: 0, perPage: 10, maxPerPage: 50 }
```

## Choosing List paging

Pass the same `list` declaration to `crudRouteMetadata()` and `listQuerySchema()`. Omitting `paging` selects offset paging and adds `page` to the query. Setting `paging: 'cursor'` selects `cursor`. Both modes apply the declared `perPage` limits. For model-backed filters, sorting or search, call `listQuerySchema({ model, ...list })` with the resolved resource.

```ts
import { crudRouteMetadata, listQuerySchema } from '@epsilon-asi/apps';

const list = { paging: 'cursor', perPage: { default: 5, max: 25 } } as const;
const routes = crudRouteMetadata({ name: 'Chapter', list });
const chapterQuery = listQuerySchema(list);
const nextChapters = chapterQuery.decode({ cursor: 'part-two', perPage: '10' });
// { cursor: 'part-two', perPage: 10 }
const firstChapters = listQuerySchema().decode({}); // { page: 0, perPage: 20 }
```

## Offset query validation

`offsetPaginationQuerySchema()` decodes URL query strings into numeric `page` and `perPage` fields. Omitted fields take the list defaults. The first page is zero, and page sizes run from one through the configured maximum. An invalid paging value produces a Zod issue on `page` or `perPage`.

```ts
import { offsetPaginationQuerySchema } from '@epsilon-asi/apps';

const reportPaging = offsetPaginationQuerySchema({ perPage: { default: 10, max: 50 } });
const firstPage = reportPaging.parse({}); // { page: 0, perPage: 10 }
const lastAllowedSize = reportPaging.parse({ page: '2', perPage: '50' }); // { page: 2, perPage: 50 }
const tooLarge = reportPaging.safeParse({ perPage: '51' }); // success is false
```

The object is strict. Use its `.extend()` method when declaring additional query fields.

## Cursor-paged list queries

Use `cursorListQuerySchema()` to accept an optional opaque cursor and the same page-size limits as offset paging. Omit the cursor for the first request. Declaring search adds the optional `q` field. An offset `page` is rejected.

```ts
import { cursorListQuerySchema } from '@epsilon-asi/apps';

const cursorQuery = cursorListQuerySchema({ perPage: { max: 10 }, search: { fields: ['title'] } });
const first = cursorQuery.decode({}); // { perPage: 10 }
const next = cursorQuery.decode({ cursor: 'next+/=', perPage: '3', q: 'report' });
const wire = cursorQuery.encode(next); // { cursor: 'next+/=', perPage: '3', q: 'report' }
```

## Sort directions and filter operators

`SortDirection` accepts the literals `'asc'` and `'desc'` as well as the named values `SortDirection.Asc` and `SortDirection.Desc`. `FilterOperator` gives each wire operator a name and is also the union of all its wire literals. `FILTER_OPERATORS` groups those values for text, enums, ranges (numbers, bigints and dates), booleans, IDs and references, and arrays. Each group supplies a corresponding type such as `TextOperator` or `RangeOperator`.

```ts
import {
  FILTER_OPERATORS, FilterOperator, filterOperatorMessageKey, FRAMEWORK_ENGLISH_MESSAGES, SortDirection,
  type RangeOperator, type TextOperator,
} from '@epsilon-asi/apps';

const newestFirst: SortDirection = SortDirection.Desc;
const nameFilter: TextOperator = FilterOperator.ILike;
const dateFilter: RangeOperator = FilterOperator.Gte;
const dateOperators = FILTER_OPERATORS.range;
const dateFilterLabel = filterOperatorMessageKey(dateFilter); // 'filters.operator.Gte'
const englishLabel = FRAMEWORK_ENGLISH_MESSAGES[dateFilterLabel]; // 'Greater than or equal to'
```

`filterOperatorMessageKey()` accepts a named operator or its wire literal. It preserves the spelling used by the translation catalog, so `'$ilike'` yields `'filters.operator.ILike'`. The frozen `FRAMEWORK_ENGLISH_MESSAGES` catalog supplies a label for each of the 13 operators. A filter menu can look up each label using the operator from its List descriptor.

For a nullable field, `FILTER_OPERATORS.nullable` adds `$exists` and equality with `null` to its base group. A nullable array’s filter descriptor can therefore list `$contains`, `$overlap`, `$exists` and `$eq`. [Array comparisons](#array-comparisons-in-list-queries)

## Automatic sort fields

Set `list.sort` to `true` on a resolved resource to expose its readable scalar fields through the List route’s `Sorts` object. Inherited fields count. Arrays, objects, JSON, resource references and server-only fields are excluded. Each descriptor has the field path and its translation key, including any explicit UI label. The object and its descriptors are frozen.

```ts
import { crudExtension, crudRouteMetadata, uiExtension, type Id, type Readable } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';

const { Prop, resolve } = createTypeRegistry().use(crudExtension).use(uiExtension);
class Product {
  @Prop.uuid({ crud: 'id' }) id!: Id<string>;
  @Prop.string({ crud: 'readable', ui: { label: 'catalog.title' } }) title!: Readable<string>;
  @Prop(z.array(z.string()), { crud: 'readable' }) tags!: Readable<string[]>;
}

const productRoutes = crudRouteMetadata({ ...resolve(Product), list: { sort: true } });
const productSorts = productRoutes.find(route => route.operation === 'List')!.Sorts;
// productSorts has id and title. Its title descriptor is { path: 'title', labelKey: 'catalog.title' }.
const titleRoutes = crudRouteMetadata({ ...resolve(Product), list: { sort: ['title'] } });
const titleSorts = titleRoutes.find(route => route.operation === 'List')!.Sorts;
// Object.keys(titleSorts) is ['title'].
const pagingSorts = crudRouteMetadata({ ...resolve(Product) }).find(route => route.operation === 'List')!.Sorts;
// Object.keys(pagingSorts) is [].
```

`resolveSorts(resolve(Product))` builds the automatic descriptors directly from the model. An explicit list such as `sort: ['title']` exposes only the named fields, in declaration order. Each entry must be an immediate readable scalar field.

Every List exposes `Sorts`. It is a frozen empty object when sorting is omitted, the allowlist is empty, or only the resource name is available. A paging-only query still rejects `orderBy`.

## Ordering list queries

Pass the resolved model and `sort: true` to either list query builder to accept an optional `orderBy`. Each key must be a readable scalar field with direction `asc` or `desc`. The key order sets the priority, so a second key can break ties in the first.

```ts
import { crudExtension, cursorListQuerySchema, offsetListQuerySchema, SortDirection, type Readable } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Ticket {
  @Prop.string({ crud: 'readable' }) subject!: Readable<string>;
  @Prop.number({ crud: 'readable' }) priority!: Readable<number>;
}

const ticketList = { model: resolve(Ticket), sort: true } as const;
const orderBy = { priority: SortDirection.Desc, subject: SortDirection.Asc };
const firstTickets = offsetListQuerySchema(ticketList).decode({ orderBy });
const moreTickets = cursorListQuerySchema(ticketList).decode({ cursor: 'next-page', orderBy });

const priorityList = { model: resolve(Ticket), sort: ['priority'] } as const;
const priorityPage = offsetListQuerySchema(priorityList).decode({ orderBy: { priority: 'desc' } });
const unlistedSort = cursorListQuerySchema(priorityList).safeParse({ orderBy: { subject: 'asc' } });
// priorityPage.orderBy is { priority: 'desc' }. unlistedSort.success is false.
```

## Filter operator declarations

Use `resolveFilterOperators()` once the field kind is known. Pass the field’s `list.filter` entry as `cap`. A value of `true` selects the operators in that field’s group. An explicit list selects a subset and is checked both by TypeScript and at definition time.

```ts
import { resolveFilterOperators } from '@epsilon-asi/apps';

const nameOperators = resolveFilterOperators({ kind: 'text', cap: ['$ilike'] });
const flagOperators = resolveFilterOperators({ kind: 'boolean', cap: true });
// nameOperators contains '$ilike'. flagOperators contains '$eq' and '$ne'.
```

Set `nullable: true` for a nullable field to allow the table’s additional operators, including `$exists`. The result is a frozen list. An explicit subset keeps the order of the first occurrence of each operator.

`resolveFieldFilter()` derives the operator group from the Zod schema. Strings support text matching. String enums and unions of string literals support equality and membership. Booleans support only `$eq` and `$ne`. Number, bigint, and `Date` fields also support ordered comparisons such as `$gte`. Arrays support `$contains` and `$overlap`. A nullable wrapper keeps the underlying group and also permits `$exists` and `$eq` for a `null` comparison.

```ts
import { resolveFieldFilter } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const titleFilter = resolveFieldFilter({ schema: z.string(), cap: ['$ilike'] });
// { kind: 'text', operators: ['$ilike'] }
const statusFilter = resolveFieldFilter({ schema: z.enum(['DRAFT', 'LIVE']), cap: true });
// { kind: 'enum', operators: ['$eq', '$ne', '$in', '$nin'] }
const stageFilter = resolveFieldFilter({ schema: z.union([z.literal('draft'), z.literal('live')]), cap: ['$in'] });
// { kind: 'enum', operators: ['$in'] }
const activeFilter = resolveFieldFilter({ schema: z.boolean(), cap: true });
// { kind: 'boolean', operators: ['$eq', '$ne'] }
const sinceFilter = resolveFieldFilter({ schema: z.date(), cap: ['$gte'] });
// { kind: 'range', operators: ['$gte'] }
const tagsFilter = resolveFieldFilter({ schema: z.array(z.string()), cap: true });
// { kind: 'array', operators: ['$contains', '$overlap'] }
const nullableTags = resolveFieldFilter({ schema: z.array(z.string()).nullable(), cap: true });
// { kind: 'array', operators: ['$contains', '$overlap', '$exists', '$eq'] }
```

## Filters on a resource

Declare a filter on an immediate readable field using `true` for its full operator group or a list for a subset. The declaration checks inherited fields and their access markers. The tenant field is already part of every tenant-scoped query, so listing it in `filter` raises `ApiDefinitionError`, even when the app gives it a custom name.

```ts
import { crudExtension, crudRouteMetadata, uiExtension, type Id, type Readable, type Tenant } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Type, Prop, resolve } = createTypeRegistry().use(crudExtension).use(uiExtension);
class WorkspaceRecord {
  @Prop.uuid({ crud: 'id' }) id!: Id<string>;
  @Prop.uuid({ crud: 'tenant' }) workspaceKey!: Tenant<string>;
  @Prop.string({ crud: 'readable' }) title!: Readable<string>;
}
@Type({ name: 'Report' })
class Report extends WorkspaceRecord {
  @(Prop.enum(['DRAFT', 'LIVE'], { crud: 'readable', ui: { label: 'reports.state' } }))
  state!: Readable<'DRAFT' | 'LIVE'>;
}

const filterableReport = { ...resolve(Report), tenancy: 'owned' } as const;
const reportRoutes = crudRouteMetadata({ ...filterableReport, list: { filter: { title: ['$ilike'], state: ['$in'] } } });
const reportFilters = reportRoutes.find(route => route.operation === 'List')!.Filters;
// reportFilters.state has path 'state', kind 'enum', operators ['$in'],
// values ['DRAFT', 'LIVE'] and labelKey 'reports.state'.
```

Each List route exposes a frozen `Filters` object. An undeclared filter contributes no entry. The descriptors, their operator lists and enum values are frozen, so a UI can use the same capabilities the declaration validated.

With a typed model, TypeScript checks the field names and operators where you declare the list. In the example, `state` accepts `$in`. Writing `staet` or using `$ilike` on `state` fails compilation. The same checks apply to `resolveFilters()` and both paging builders. Runtime validation also checks declarations supplied by JavaScript.

## Equality in list queries

Both pagers accept scalar equality (`$eq`) and inequality (`$ne`) on fields that declare them. Each supplied field needs at least one comparison. When a field permits multiple operators, they can appear together. An undeclared field or operator fails validation. On an eligible list, omitting `where` or passing `where: {}` adds no conditions.

```ts
import { crudExtension, cursorListQuerySchema, offsetListQuerySchema, type Readable } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Invoice {
  @(Prop.enum(['DUE', 'PAID'], { crud: 'readable' })) status!: Readable<'DUE' | 'PAID'>;
  @Prop.number({ crud: 'readable', min: 0 }) total!: Readable<number>;
}

const invoiceList = { model: resolve(Invoice), filter: { status: ['$eq', '$ne'], total: true } } as const;
const matchInvoice = { where: { status: { $eq: 'PAID' }, total: { $eq: '42.50' } } } as const;
export const offsetInvoices = offsetListQuerySchema(invoiceList);
const paidPage = offsetInvoices.decode(matchInvoice);
const paidCursor = cursorListQuerySchema(invoiceList).decode({ ...matchInvoice, cursor: 'next' });
const wireInvoice = offsetInvoices.encode(paidPage);
// Both pages compare total with the number 42.5. The encoded comparison is the string '42.5'.
const outstanding = offsetInvoices.decode({ where: { status: { $ne: 'PAID' } } });
```

Pass the nested wire object to these schemas. Numbers, bigints, booleans and dates round-trip through strings. A field with a two-way string codec can use its own wire format. Enum comparisons use the stored choices shown in `List.Filters`. On a nullable scalar, `$eq: null` matches a null value and `$ne` takes a non-null operand. Each condition requires a value even when the field has a create default. The typed client and Express adapter use the shared bracket codec for generated offset lists with declared scalar equality filters and sort keys. [Listing offerings](#listing-offerings)

## Range comparisons in list queries

Declare `$gt`, `$gte`, `$lt` or `$lte` on a number, bigint or date field to accept those comparisons in either pager. A field can take a lower and an upper bound in the same condition. The bounds use the field's wire format and decode to its stored type.

```ts
import { crudExtension, cursorListQuerySchema, type Readable } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Delivery {
  @Prop.date({ crud: 'readable' }) dueAt!: Readable<Date>;
}

export const deliveryQuery = cursorListQuerySchema({
  model: resolve(Delivery), filter: { dueAt: ['$gte', '$lt'] },
});
const november = deliveryQuery.decode({
  where: { dueAt: { $gte: '2026-11-01T00:00:00Z', $lt: '2026-12-01T00:00:00Z' } },
});
const wireNovember = deliveryQuery.encode(november);
// The handler sees Date bounds. The encoded bounds are UTC timestamp strings.
```

## Text patterns and nullable fields

Both pagers accept `$like` and `$ilike` on text fields that declare them. Use `$like` for case-sensitive matching and `$ilike` for case-insensitive matching. The query passes the pattern through exactly as supplied, including wildcards and escapes. Enum fields reject both operators.

A nullable field, including an array, can declare `$exists`. A decoded `true` asks for rows where the field has a value, and `false` asks for rows where it is null. The wire codec encodes the Boolean as `'true'` or `'false'`.

```ts
import { crudExtension, cursorListQuerySchema, type Readable } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Card {
  @Prop.string({ crud: 'readable' }) title!: Readable<string>;
  @Prop(z.array(z.string()).nullable(), { crud: 'readable' }) tags!: Readable<string[] | null>;
}

export const cardQuery = cursorListQuerySchema({
  model: resolve(Card), filter: { title: ['$like', '$ilike'], tags: ['$exists'] },
});
const untagged = cardQuery.decode({
  where: { title: { $ilike: 'draft_%' }, tags: { $exists: 'false' } },
});
const wireCards = cardQuery.encode(untagged);
// The handler sees { $exists: false }. Encoding restores { $exists: 'false' }.
```

## Array comparisons in list queries

Declare `$contains` to ask for all the supplied elements or `$overlap` to ask for any of them. Offset and cursor queries validate each operand against the array’s element schema. A nullable array can also declare `$eq` for an explicit `null`. Passing an entire array to `$eq` raises a validation error.

An empty operand is valid for either membership operator, even if the stored array must be nonempty. When elements are decorated resources, the filter accepts only readable fields, including in nested references.

For a codec that decodes a string into an object, supply the object’s readable fields in their query wire format. For example, if the stored element is `{ value: number }`, the operand is `[{ value: '20' }]`.

```ts
import { crudExtension, offsetListQuerySchema, type Readable } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Shipment {
  @Prop(z.array(z.int().positive()).nullable(), { crud: 'readable' }) bins!: Readable<number[] | null>;
}

export const shipmentQuery = offsetListQuerySchema({ model: resolve(Shipment), filter: { bins: true } });
const selectedBins = shipmentQuery.decode({ where: { bins: { $contains: ['12'], $overlap: ['4', '9'] } } });
const wireBins = shipmentQuery.encode(selectedBins);
const unassigned = shipmentQuery.decode({ where: { bins: { $eq: null } } });
// The handler sees [12] and [4, 9]. Encoding restores the string operands.
```

## Search queries

Pass the list declaration to `offsetListQuerySchema()`. Declaring `search.fields` enables an optional `q` alongside the paging fields. It preserves the input string and caps its length at `DEFAULT_MAX_SEARCH_LENGTH` (200). An overlong query produces a validation issue on `q`. A paging-only list rejects `q`.

```ts
import { offsetListQuerySchema } from '@epsilon-asi/apps';

const listQuery = offsetListQuerySchema({ search: { fields: ['title'] } });
const query = listQuery.parse({ q: 'monthly invoices' });
// { page: 0, perPage: 20, q: 'monthly invoices' }
```

Pass the resolved model to either pager or to the CRUD declaration to check `list.search.fields` against the resource. TypeScript accepts inherited readable fields and flags stale names and server-only fields at the declaration. Runtime validation reports an `ApiDefinitionError` naming the resource and field when declarations come from JavaScript.

```ts
import { crudExtension, cursorListQuerySchema, type Readable, type WriteOnly } from '@epsilon-asi/apps';
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class TitledRecord {
  @Prop.string({ crud: 'readable' }) title!: Readable<string>;
}
class Report extends TitledRecord {
  @Prop.string({ crud: 'writeOnly' }) draftNote!: WriteOnly<string>;
}

const reportModel = resolve(Report);
const reportSearch = cursorListQuerySchema({ model: reportModel, search: { fields: ['title'] } });
const match = reportSearch.decode({ q: 'monthly' }); // { perPage: 20, q: 'monthly' }
```

For a custom query object, use the exported `searchQuerySchema.optional()` for its `q` field.

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

## JSON Schema for wire inputs

`wireInputJsonSchema()` describes the values a caller sends. OpenAPI and agent tools can use it on a request schema that contains codecs. A date becomes a date-time string, and a numeric query field becomes a string with a number pattern.

```ts
import { dateWireCodec, numberWireCodec, wireInputJsonSchema } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const reportInput = wireInputJsonSchema(z.strictObject({
  since: dateWireCodec,
  amount: numberWireCodec.optional(),
}));
// Only since is required. Both fields accept strings on the wire.
```

## Success responses

`SuccessResponse<Data>` describes what a caller receives from an endpoint that declares response data. Its `code` uses the `SUCCESS_CODES` type, the union `200 | 201`. The frozen `SUCCESS_CODES` object gives those values the names `Ok` and `Created`. The `data` property is required even for a nullable payload, and `message` is an optional string.

```ts
import { SUCCESS_CODES, type EmptySuccessResponse, type SuccessResponse } from '@epsilon-asi/apps';

const created: SuccessResponse<{ id: string }> = {
  code: SUCCESS_CODES.Created,
  data: { id: 'offering-17' },
  message: 'offering.created',
};
const deleted: EmptySuccessResponse = { code: SUCCESS_CODES.Ok };
```

Use `EmptySuccessResponse` for an endpoint such as Delete that declares no payload. Its default code is `200`, and it can carry a message. Use `EmptySuccessResponse<201>` for a custom endpoint that declares a payload-free `201` response.

`successResponseSchema()` validates the envelope at runtime. Supply the endpoint’s status and its payload schema to require `data` and carry the payload’s codecs through encoding and decoding. Omit the payload schema for a response that carries only its status and optional message.

```ts
import { dateWireCodec, successResponseSchema } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const createdChapter = successResponseSchema({ code: 201, data: z.object({ publishedAt: dateWireCodec }) });
const publication = createdChapter.decode({ code: 201, data: { publishedAt: '2026-11-19T09:00:00Z' } });
const timestamp = publication.data.publishedAt.toISOString(); // '2026-11-19T09:00:00.000Z'

const deletedChapter = successResponseSchema({ code: 200 });
const deletion = deletedChapter.decode({ code: 200, message: 'Chapter deleted' });
```

## Success responses from CRUD routes

Pass the selected route and its readable row schema to `crudSuccessResponseSchema()`. Create uses `201`, and Get and Update use `200`. List uses the route’s `listResponse` metadata to wrap its rows under the declared plural with the correct paging field. Delete takes the route alone and produces a payload-free `200`.

```ts
import { crudRouteMetadata, crudSuccessResponseSchema, dateWireCodec } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const routes = crudRouteMetadata({ name: 'Person', plural: 'People', list: { paging: 'cursor' } });
const row = z.object({ joinedAt: dateWireCodec });
const createPerson = crudSuccessResponseSchema({ route: routes.find(r => r.operation === 'Create')!, row });
const listPeople = crudSuccessResponseSchema({ route: routes.find(r => r.operation === 'List')!, row });
const deletePerson = crudSuccessResponseSchema({ route: routes.find(r => r.operation === 'Delete')! });

const person = createPerson.decode({ code: 201, data: { joinedAt: '2026-11-19T09:00:00Z' } });
const lastPage = listPeople.decode({ code: 200, data: { people: [], nextCursor: null } });
const deleted = deletePerson.decode({ code: 200 });
```

## Offset-paged list responses

`OffsetListResponseData` derives the rows from the resource’s read model and uses the same collection key as `listResponseKey()`. Choose a collection key distinct from `count`, which holds the total and can exceed the number of rows on the page.

```ts
import type { Id, OffsetListResponseData, Readable } from '@epsilon-asi/apps';

class Company {
  declare id: Id<string>;
  declare name: Readable<string>;
}
const companyResource = { name: 'Company', plural: 'Companies' } as const;
const companyPage: OffsetListResponseData<typeof Company, typeof companyResource> = {
  companies: [{ id: 'company-17', name: 'Acme' }],
  count: 12,
};
```

## Cursor-paged list responses

`CursorListResponseData` uses the same collection key and readable row type as offset paging. Each page includes `nextCursor`. Pass that string unchanged in the next request’s `cursor` field. A value of `null` marks the last page.

```ts
import type { CursorListResponseData, Id, Readable } from '@epsilon-asi/apps';

class Person {
  declare id: Id<string>;
  declare name: Readable<string>;
}
type PeoplePage = CursorListResponseData<typeof Person, { name: 'Person'; plural: 'People' }>;
const peoplePage: PeoplePage = { people: [{ id: 'p1', name: 'Lee' }], nextCursor: 'next+/=' };
const lastPeoplePage: PeoplePage = { people: [{ id: 'p2', name: 'Sam' }], nextCursor: null };
```

## Validating List response data

Give `listResponseDataSchema()` the resource name, its optional plural, and the schema for one readable row. The returned schema uses the derived collection key. Offset pages require the total `count` as a nonnegative safe integer. Cursor pages require `nextCursor`, with `null` marking the last page. The collection key must be distinct from its paging field. Pass this schema to `successResponseSchema()` to build the full List response.

```ts
import { dateWireCodec, listResponseDataSchema, successResponseSchema } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const people = { name: 'Person', plural: 'People', row: z.object({ joinedAt: dateWireCodec }) } as const;
const offsetPeople = listResponseDataSchema(people);
const emptyPage = offsetPeople.decode({ people: [], count: 0 });

const cursorPeople = listResponseDataSchema({ ...people, paging: 'cursor' });
const response = successResponseSchema({ code: 200, data: cursorPeople });
const lastPage = response.decode({ code: 200, data: {
  people: [{ joinedAt: '2026-11-19T09:00:00Z' }], nextCursor: null,
} });
// lastPage.data.people[0].joinedAt is a Date.
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

Use `requestValidationIssues()` to convert Zod errors from the request sections to the field names a form or handler knows. Pass the route’s `paramFields` mapping so an error on an aliased path parameter names the flat request field.

```ts
import { requestValidationIssues } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const route = { path: '/chapters/:chapterId', paramFields: { chapterId: 'key' } };
const content = z.strictObject({
  params: z.strictObject({ chapterId: z.uuid() }), body: z.strictObject({ title: z.string().min(1) }),
});
const parsed = content.safeParse({ params: { chapterId: 'bad-id' }, body: { title: '' } });
const chapterIssues = parsed.success ? [] : requestValidationIssues({ ...route, issues: parsed.error.issues });
// The two issue paths are 'key' and 'title'. Each keeps Zod’s message and code.
```

An issue inside a nested value names the owning flat field. For example, an invalid comparison under `query.where` reports `where`. For a strict request section, each unrecognized field gets its own issue. An error on the whole request or section uses `path: ''` so the form can display it outside any single field.

### Building a 422 response

Pass the Zod error, route, namespaced error identifier and trace ID to `validationFailureResponse()` to build the body for a failed request. A form can use the issue paths directly, including the empty path for a rule that spans fields.

```ts
import { requestContentSchema, validationFailureResponse } from '@epsilon-asi/apps';
import { z } from 'zod/v4';

const route = { path: '/chapters/:chapterId', paramFields: { chapterId: 'key' } };
const content = requestContentSchema({
  params: z.strictObject({ chapterId: z.string().min(2, { error: 'chapter.key.invalid' }) }),
  body: z.strictObject({ start: z.number(), end: z.number() }),
}).refine(({ body }) => body.start < body.end, { error: 'chapter.range.invalid' });
const parsed = content.safeParse({ params: { chapterId: 'a' }, body: { start: 3, end: 2 }, query: {}, headers: {} });
const chapterFailure = parsed.success ? undefined : validationFailureResponse({
  ...route, zodError: parsed.error, error: 'Chapter.INVALID_RANGE', traceId: 'request-17',
});
// chapterFailure has code 422 and issue paths 'key' and ''.
```

## Authentication failures

`AuthenticationFailureResponse` requires status `401`, the request’s `traceId`, and one of two wire errors. `Auth.TOKEN_EXPIRED` identifies an expired access token so a client can decide when to refresh. Other authentication failures use `Auth.UNAUTHENTICATED`. Look up either error in the English catalog with `domainErrorMessageKey()`.

```ts
import { domainErrorMessageKey, FRAMEWORK_ENGLISH_MESSAGES, type AuthenticationFailureResponse } from '@epsilon-asi/apps';

const expired: AuthenticationFailureResponse = {
  code: 401,
  error: 'Auth.TOKEN_EXPIRED',
  traceId: 'request-18',
};
const expiredMessage = FRAMEWORK_ENGLISH_MESSAGES[domainErrorMessageKey(expired.error)];
// 'Your access token has expired.'
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

`failure.notFound()` lets a handler return a typed 404. `isFailure()` recognizes that result even when an ordinary success payload also has a `code` field. The HTTP adapter includes the request’s trace ID in the 404 response.

```ts
import { failure, isFailure, type Failure } from '@epsilon-asi/apps';

function findOffering(id: string): { id: string } | Failure {
  return id === 'of_1' ? { id } : failure.notFound();
}

const lookup = findOffering('missing');
const status = isFailure(lookup) ? lookup.code : 200; // 404
```

`NotFoundFailureResponse` carries status `404`, a namespaced error and the request’s trace ID. The same response describes a missing resource and one outside the caller’s tenant, so callers cannot distinguish those cases.

```ts
import type { NotFoundFailureResponse } from '@epsilon-asi/apps';

const missingOffering: NotFoundFailureResponse = {
  code: 404,
  error: 'Offering.NOT_FOUND',
  traceId: 'request-20',
};
```

## Conflict responses

`ConflictFailureResponse` carries status `409`, a namespaced wire error and the request’s trace ID. For example, a duplicate request can conflict with one already in progress.

```ts
import type { ConflictFailureResponse } from '@epsilon-asi/apps';

const inProgress: ConflictFailureResponse = {
  code: 409,
  error: 'Idempotency.IN_PROGRESS',
  traceId: 'request-21',
};
```

## Other client failures

`ClientFailureResponse` carries the HTTP status, a namespaced error and the request’s trace ID. Use it for statuses such as 400, 402 and 429. An endpoint can narrow its allowed codes with `ClientFailureResponse<402>`. Statuses 401, 403, 404, 409 and 422 have their own response types, so narrowing a failure by its status also narrows its fields.

```ts
import type { ClientFailureResponse } from '@epsilon-asi/apps';

const unpaid = {
  code: 402,
  error: 'OrgBilling.UNPAID',
  traceId: 'request-42',
} satisfies ClientFailureResponse;
```

## Client failure codes

`CLIENT_FAILURE_CODES` names the eight client statuses used by the framework. Its values form the same-named TypeScript type. Use a named status when constructing a failure or matching the result of `defaultFailureCodes()`.

```ts
import { CLIENT_FAILURE_CODES, type ClientFailureResponse } from '@epsilon-asi/apps';

const missingTenant: CLIENT_FAILURE_CODES = CLIENT_FAILURE_CODES.BadRequest; // 400
const rateLimitFailure = {
  code: CLIENT_FAILURE_CODES.TooManyRequests, error: 'RateLimit.EXCEEDED', traceId: 'request-7',
} satisfies ClientFailureResponse<429>;
```

## Server failure codes

`SERVER_FAILURE_CODES` is a frozen table. Its same-named type accepts the two statuses the framework uses for an unexpected server error or an unavailable dependency.

```ts
import { SERVER_FAILURE_CODES } from '@epsilon-asi/apps';

const unexpected: SERVER_FAILURE_CODES = SERVER_FAILURE_CODES.InternalServerError; // 500
const unavailable: SERVER_FAILURE_CODES = SERVER_FAILURE_CODES.ServiceUnavailable; // 503
```

## Internal server errors

`ServerFailureResponse` carries status `500`, a public namespaced error identifier and the request’s trace ID. Keep exception messages and stack traces in the server logs, where the trace ID can be used to find them.

```ts
import { SERVER_FAILURE_CODES, type ServerFailureResponse } from '@epsilon-asi/apps';

const serverFailure: ServerFailureResponse = {
  code: SERVER_FAILURE_CODES.InternalServerError,
  error: 'Server.INTERNAL',
  traceId: 'request-42',
};
```

## Unavailable dependencies

Use `UnavailableFailureResponse` for the JSON body when a dependency is temporarily unavailable. `UnavailableFailureHttpResponse` pairs that body with the required `Retry-After` header. Supply a delay in seconds or an HTTP date as the header value.

```ts
import { SERVER_FAILURE_CODES, type UnavailableFailureHttpResponse } from '@epsilon-asi/apps';

const unavailableSession = {
  body: { code: SERVER_FAILURE_CODES.ServiceUnavailable, error: 'Session.UNAVAILABLE', traceId: 'request-42' },
  headers: { 'Retry-After': '30' },
} satisfies UnavailableFailureHttpResponse;

const response = Response.json(unavailableSession.body, {
  status: unavailableSession.body.code,
  headers: unavailableSession.headers,
});
```

## Named domain errors

`defineErrors()` gives each declared failure an exception class, an HTTP status and a stable name for the wire and workers. The `Types` table and each exception’s `type` carry the same literal. Use `DomainErrorsOf` when a handler or worker needs to distinguish the cases in one domain.

```ts
import { defineErrors, domainErrorMessageKey, type DomainErrorsOf } from '@epsilon-asi/apps';

const OrgBillingError = defineErrors('OrgBilling', {
  UNPAID: { code: 402 },
  FEATURE_RESTRICTED: { code: 403 },
});
type OrgBillingErrors = DomainErrorsOf<typeof OrgBillingError>;
const unpaidInvoice = new OrgBillingError.Unpaid();
const billingLabel = domainErrorMessageKey(unpaidInvoice.error); // 'errors.OrgBilling.UNPAID'

function isPaymentRequired(error: OrgBillingErrors) {
  return error.type === OrgBillingError.Types.UNPAID && error.code === 402;
}
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
