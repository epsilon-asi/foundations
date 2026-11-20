# Resource framework naming conventions

These conventions describe the planned resource framework. For current exports and implementation progress, see the [package README](../README.md) and the [resource framework plan](https://github.com/epsilon-asi/foundations/blob/main/docs/plans/resource-framework.md).

## From a resource name to a public contract

Give each resource a singular PascalCase name and write acronyms as words, as in `ApiKey`. Consecutive capitals make TypeScript's `Uncapitalize` and the runtime `toCamelCase` disagree. The `name` literal passed to `endpoints()` is the source of truth. In development and tests, it must match the resource's class name. Production derivation uses the literal. Only esbuild has been verified to preserve class names in the plan's minification checks.

| Derived name | Example for `ApiKey` |
| --- | --- |
| Resource class and file in `common/src/resources/` | `ApiKey` in `ApiKey.ts` |
| CRUD endpoint exports | `CreateApiKey`, `GetApiKey`, `UpdateApiKey`, `DeleteApiKey`, `ListApiKeys` |
| Collection and item paths | `/api-keys`, `/api-keys/:apiKeyId` |
| Item parameter and list response key | `apiKeyId`, `apiKeys` |

The default plural appends `s` to the literal name. A name ending in `s`, `x`, `y`, `ch` or `sh` produces one warning per CRUD declaration unless the declaration supplies `plural`. For example, `endpoints(Company, { name: 'Company', plural: 'Companies' })` gives `ListCompanies` and `/companies`. [CRUD route metadata](../README.md#crud-route-metadata)

Collection paths use `/<kebab-plural>` and item paths add `/:<entity>Id`. A parent adds `/<parent-kebab-plural>/:<parent>Id` before the collection, as in `/campaigns/:campaignId/sales-threads/:salesThreadId`. Each path parameter maps to a flat request field. On a resolved CRUD model, the item parameter maps to the declared primary key, including an inherited field. For example, an `ApiKey` resource can use `key` in the flat request and `apiKeyId` in the path. [CRUD primary keys](../README.md#crud-primary-keys)

The framework reserves `bulk` and `restore` as path segments and transition verbs. CRUD resource and operation settings, transition declarations and per-verb settings reserve `softDelete`, `versioned`, `deprecated`, `suspended` and `impersonation`. Resource fields can use these names. [Reserved names](../README.md#reserved-route-names)

The tenant travels in a header. For tenant resource `Organization`, the default names are `X-Organization-Id`, `ctx.organization`, `ctx.membership` and `organizationId`. In general, these are `X-<Tenant>-Id`, `ctx.<tenant>`, `ctx.membership` and `<tenant>Id`. Set `header`, `context` or `field` in `createResourceSystem({ tenant: { resource, … } })` to override the corresponding name. The tenant's own route is singular (`/organization`), and its transitions use `POST /organization/<verb>`.

## Shared contracts

Put the declarations used by the API, UI and workers in the application's `common` package.

| Declaration | File | Named exports |
| --- | --- | --- |
| Application system | `common/src/app.ts` | Destructure `Resource`, `Prop`, `endpoints`, `endpoint`, `defineStateMachine`, `transitions` and `Access` from `createResourceSystem(…)`. |
| Resource | `common/src/resources/<Entity>.ts` | The decorated class `<Entity>` and the enabled `endpoints()` exports. The five CRUD names are `Create<Entity>`, `Get<Entity>`, `Update<Entity>`, `Delete<Entity>` and `List<Entities>`. |
| State machine | Same resource file | `<Entity>Lifecycle` from `defineStateMachine`, and `<Verb><Entity>` exports from `transitions`, as in `OfferingLifecycle` and `PublishOffering`. |
| Custom action | Same resource file, or `common/src/endpoints/<Entity>/<VerbNoun>.ts` for a large declaration | `<VerbNoun>` from `endpoint({ … })`. |
| Errors | `common/src/errors/<Domain>.ts` | `<Domain>Error` with `.Types` and a class for each error type, plus the `<Domain>Errors` union. |
| Topic | `common/src/topics/<Topic>.ts` | `<Topic>` from `defineTopic`, such as `ScheduledEmail`. A consumer field handles it. |
| Job | `common/src/jobs/<Job>.ts` | `<Job>` from `defineJob`, such as `SendReceipt`. A job handler field handles it. |
| Events | `common/src/events/<Domain>.ts` | `<Domain>Events` and `<Domain>Event` from `defineEvents`, as in `CampaignEvent.New(type, data)`. |
| Meter | `common/src/meters.ts` | `<Name>Meter` from `defineMeter`. |

Every endpoint exposes the same members. Use `RequestContentOf<typeof CreateOffering>` for the encoded sections sent over the wire and `RequestOf<typeof CreateOffering>` for the decoded flat request. A wire request supplies `params`, `query`, `body` and `headers`, using `{}` for each unused section. Use `ResponseOf<typeof CreateOffering>` for the decoded success envelope and `ResponseDataOf<typeof CreateOffering>` for its payload. [Request content schemas](../README.md#request-content-schemas) · [Endpoint type example](../README.md#endpoint-request-and-response-types)

Use `ListQueryOf<typeof ListOfferings>` when a caller needs the decoded list query on its own. Its fields follow the endpoint’s paging, filtering, sorting and search declarations. [List query example](../README.md#list-query-types)

A `422` issue names the field on the flat request. An aliased path parameter uses its mapped name, and an issue below a nested field uses the owning field’s name. An empty path identifies an error on the form as a whole. [Validation failure example](../README.md#validation-failures)

| Purpose | Members or types |
| --- | --- |
| Contract | `Name`, `Kind`, `Method`, `Path`, `Access`, `Route`. The route contract exposes the original descriptor and its resolved access rule. [Contract members](../README.md#reading-endpoint-contract-members) |
| Schemas | `Request`, `RequestContent`, `Response`, `ResponseData`, `ResponseTypeUnion` |
| Call and wire conversion | `Call`, `toContent`, `fromContent` |
| List descriptors | `Filters`, `Sorts` on every list endpoint |
| Types derived from an endpoint | `RequestOf`, `RequestContentOf`, `ResponseOf`, `ResponseDataOf`, `ResponseTypeUnionOf` take `typeof Endpoint`. `ListQueryOf<typeof ListOfferings>` takes a list endpoint. |
| Types derived from a resource | `ReadModel<typeof Offering>`, `CreateInput<typeof Offering>`, `UpdateInput<typeof Offering>` |

## Runtime discovery

Place the following modules in folders beside the process entry module. Each runner discovers modules by folder and filename suffix and reads their decorated classes. For example, an API started from `src/main.ts` finds `src/routes/OfferingRoutes.ts`. If the build emits `dist/main.js`, it finds `dist/routes/OfferingRoutes.js`. Use standard decorators with `experimentalDecorators` off.

| Entry point | Source file in a split application | Class and fields |
| --- | --- | --- |
| `runApi()` | `api/src/routes/<Entity>Routes.ts` | `@Routes()` on `<Entity>Routes`. Use camelCase verb fields such as `create`, `list` and `publish`. The endpoint passed to `handler(Endpoint, { use?, handle })` identifies the operation. |
| `runApi()` | `api/src/webhooks/<Provider>Webhook.ts` | Bind `<provider> = webhook({ path, verify })`. Decorate `<Provider>Webhook` with `@<provider>.Webhook()`. An event field binds the provider's event type, as in `invoicePaid = stripe.on('invoice.paid', { handle })`. |
| `runConsumer()` | `workers/src/consumers/<Domain>Consumers.ts` | `@Consumers()` on `<Domain>Consumers`, with a verb field such as `send = consumer(ScheduledEmail, { handle })`. |
| `runWorker()` | `workers/src/jobs/<Domain>Jobs.ts` | `@Jobs()` on `<Domain>Jobs`, with a verb field such as `sendReceipt = job(SendReceipt, { handle })`. |
| `runDaemon()` | `workers/src/loops/<Domain>Loops.ts` | `@Loops()` on `<Domain>Loops`. Both the decorator and `loop({ every, run })` come from `@epsilon-asi/apps/jobs`. The class and field name identify the loop, as in `MaintenanceLoops.refreshTokens`. |

Put runtime services in the named `services` export of `services.ts` beside the entry module, in startup order. The runners work with zero arguments. `runApp()` discovers the same folders beside a single entry point and runs the declared parts together. `APP_PARTS` selects parts per deployment.

For a nonstandard routes folder, set `routesDir` (default `DEFAULT_ROUTES_DIR = 'routes'`). Bundles and tests can supply classes explicitly, as in `runApi({ routes: [OfferingRoutes] })` or `runConsumer({ consumers: [EmailConsumers] })`.

An ORM-backed resource can declare all its CRUD routes in two lines. A field on the same class can override the default handler for a particular endpoint.

```ts
// api/src/routes/OfferingRoutes.ts
@Routes({ defaults: crudHandlers(Offering) })
export class OfferingRoutes {}
```

| Supporting declaration | File | Name and use |
| --- | --- | --- |
| Route group | `api/src/routes/groups.ts`, or the routes file for a single class | `<concern> = group({ use })`. Pair `@<concern>.Routes()` with `<concern>.handler(…)`. |
| Worker group | `workers/src/groups.ts`, or the class file for a single class | `<concern> = consumerGroup({ use })` or `jobGroup({ use })`. Pair `@<concern>.Consumers()` with `<concern>.consumer(…)`, or `@<concern>.Jobs()` with `<concern>.job(…)`. |
| Large handler | `api/src/handlers/<Entity>/<Endpoint>.ts` | Export `<Endpoint>Handler = handler(<Endpoint>, …)` and assign it to a field of `<Entity>Routes`. |
| HTTP middleware | `api/src/middleware/<concern>.ts` | A camelCase value such as `checkQuota`. Use `requireAccess('<ROLE>')` for role checks. |
| ORM service | `api/src/services/<Entity>Service.ts` | `class <Entity>Service extends ResourceService(<Entity>)`. |
| Factory | `api/test/factories/<Entity>Factory.ts` | `<Entity>Factory` from `defineFactory`. |
| Seed | `api/src/seeds/<Name>.ts` | `<Name>Seed` from `defineSeed`. |
| Provider adapter | `<concern>/<provider>/` in the framework | `<Provider><Concern>` from `@epsilon-asi/apps/<concern>/<provider>`, as in `GcpPubSubTransport` from `@epsilon-asi/apps/pubsub/gcp`. |

## Forms, contexts and message keys

| UI file | Factory and named exports |
| --- | --- |
| `ui/src/forms/<entity>/<verb>-<entity>.tsx` | Each form exports `FormContext`, `FormProvider`, `useFormContext`, `useFormSubmit`, `SubmitButton` and `Field` from `CreateFormContext`. For example, `ui/src/forms/offering/create-offering.tsx` binds `CreateOffering`. |
| `ui/src/context/<entities>.tsx` | `CreateQueryProvider(ListOfferings)` produces `OfferingsProvider`, `OfferingsContext`, `OfferingsConsumer` and `useOfferings`, using the plural name. |
| `ui/src/context/<entity>.tsx` | `CreateResourceContext(GetOffering)` produces `OfferingProvider`, `OfferingContext` and `useOffering`, using the singular name. |

| Message | Key | Example |
| --- | --- | --- |
| Field label | `<entity>.<field>` | `offering.name` |
| Placeholder | `<entity>.<field>.placeholder` | `offering.name.placeholder` |
| Helper text | `<entity>.<field>.helper` | `offering.name.helper` |
| Enum option | `<entity>.<field>.<VALUE>` | `offering.status.DRAFT` |
| Domain error | `errors.<Domain>.<TYPE>` | `errors.OrgBilling.UNPAID` for wire error `OrgBilling.UNPAID` |
| Filter operator | `filters.operator.<NAME>` | `filters.operator.Gte` for `FilterOperator.Gte` |

`messageKeys(resolve(Resource))` lists the catalog entries for the resource and its readable or writable fields. A field’s explicit text key replaces the corresponding default. The List filter and sort descriptors use that same field label. Operator menus use the English catalog’s `filters.operator.<NAME>` keys. Authentication failures use `errors.Auth.UNAUTHENTICATED` and `errors.Auth.TOKEN_EXPIRED` in the same catalog. [Resource catalog example](../README.md#resource-translation-keys) · [Operator labels](../README.md#sort-directions-and-filter-operators) · [Authentication messages](../README.md#authentication-failures)

## Checks

Definitions must have unique method/path pairs. Every path parameter must map to a request field. Every tenant-owned resource must have exactly one `Tenant` field with the configured name (default `<tenant>Id`). Access rules must refer to declared roles, permissions and entitlements. Definition errors identify the offending declaration.

For a model-backed CRUD route, `access.fields.<field>.write` requires a field that an enabled Create or Update accepts. A field rule can narrow who may write a value only within the model’s write grants. [Field write rules](../README.md#field-write-rules)

To inspect the rule declared for a CRUD operation, read its descriptor’s `Access` member. It resolves the operation override and the applicable `read` or `write` fallback. [Shared resource access](../README.md#shared-resource-access)

A routes class rejects two fields bound to the same endpoint and handlers for disabled operations. A webhook class rejects duplicate event types. Within one app, each topic has at most one consumer and each job at most one handler.

At startup the API checks that each enabled endpoint it serves has a handler or a default on a discovered or explicitly supplied routes class. Workers check that they have classes to serve and that each bound topic or job can be served. Each failure names the missing binding. The cross-app CI check also verifies that every topic has a consumer and every job has a handler.
