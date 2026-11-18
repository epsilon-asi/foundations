# Plan: the resource framework (`@epsilon-asi/apps` and friends)

> **Revised 2026-11-15.** This revision applies the findings of `docs/reviews/resource-framework-plan-review.md` and the answers to its open questions. Finding ids (C1–C7, M1–M14) and spike ids (S0–S6) refer to that review. Everything not listed under "Open decisions" is decided. A second pass the same day settled unmarked fields, cloud providers, ID generation and MFA. A third pass set sessions to bearer tokens with their state in Redis, made the API the public API, and applied a contradiction review. A fourth pass on 2026-11-16 settled local pub/sub and brought API versioning into scope. A fifth pass the same day closed every open decision. A sixth pass on 2026-11-17 applied an independent contradiction review, and the plan moved into the repo at `docs/plans/resource-framework.md`, which is now the copy to edit. A seventh pass the same day cut the first release: the features under "Deferred features" wait, each with a seam kept, and their designs moved to the appendix.

## Context

maxleads already works this way: one contract in `common` is shared by the API, the UI and the workers. Every app adds only its own pieces:

- **API:** `RegisterRoute({ ...CreateOffering.Route, Authorization, Controller })`.
- **UI:** `CreateFormContext({ validation: CreateOffering.Request, onSubmit: d => CreateOffering.Call(d.destruct()) })` and `CreateQueryProvider(ListOfferings.Call)`.
- **Workers:** `PubSubHandler(XMessage, handler)`.

On top of that contract, maxleads has:

- **Context flows:** steps that grow the typed context. For example, `Verify.User.RoleInOrgIs.Editor` turns a plain authenticated context into an `OrganizationRequestContext`.
- **Free services:** `EntityService<T>`, `FindManyRepository` and `ServiceManager`, which give Create/List/Delete and one flush per unit of work.
- **Pattern naming everywhere:** `<Verb><Entity>` namespaces with fixed members, `<Entity>Routes`, `<Entity>Controller`, `<Entity>Service`, `UF<Entity>`, `<Topic>Message`/`<Topic>PubSubHandler`, `<Domain>Event.New()`, and `forms/<entity>/<verb>-<entity>.tsx` files that all export the same names.

The pattern is proven. What it costs:

- **Every field is declared about six times:** the entity, the `UF*` DTO, `RequestContent` and `Request` for each of five endpoints, and the UI defaults. The copies drift.
- **The glue is hand-written and partly broken.** Rate limits are computed but never attached. The 404 catch-all runs after every success. ADMINISTRATOR fails every `Verify`. Business exceptions become 500s. Nothing ties a controller's declared context to what its route provides. Filter and sort are unvalidated. Forms drop server 422 field errors. Workers never shut down cleanly.
- **Security holes come from the glue too.** Rows are looked up by id without a tenant check, the query parser allows prototype pollution, passwords use a fast hash, and SSO accounts share a sentinel password. See "Security requirements".
- **Generators exist** only to manage the boilerplate.

**The outcome this plan builds:** a foundational framework in this repo that holds everything needed to build and run a production-grade, multi-tenant SaaS application.

One decorated class per entity drives:
- validation, for the API and for forms;
- response projection;
- pattern-named endpoints and a typed client;
- routes with typed middleware and context;
- tenancy and access rules that the server and the UI share;
- ORM entities, typed queries and free services;
- messaging and jobs;
- tools for AI agents.

Kits on top provide identity and accounts, tenant deletion, billing and entitlements, email, usage metering and audit. Other kits are deferred (see "Deferred features").

How it's built:
- Each concern is an extension, and heavy dependencies load only where they're imported.
- Types flow end to end, and call sites stay minimal.
- Security defaults are on.
- Everything is pattern-named, so a resource can be copied and renamed.

The first concrete deliverable, which was the original ask, is an express app whose CRUD endpoints come from a single entity. Its requests are fully typed and validated, and its handlers only log.

**maxleads is a reference, not a migration target.** Nothing here has to stay compatible with maxleads' clients, its MikroORM 5.9 setup or its envelope. Its good patterns are kept. Its security issues matter only where code or patterns are carried into this repo, and those are covered under "Security requirements".

### Decisions already made

| Topic | Decision |
|---|---|
| Monorepo tooling | **pnpm workspaces.** Packages depend on each other through `workspace:^` ranges, so `apps` builds against foundation's source without an npm release. One root lockfile replaces the per-package lockfiles. `scripts/release.sh` stays the release tool for now. |
| Release loop | The old "release foundation to npm first, then bump dependents" step is gone. |
| Phase numbering | Phase 0 runs from 0.0 (toolchain) to 0.5 (re-tool `apps`). Spikes run between Phase 0 and Phase 1. |
| Open questions | When in doubt, a question blocks the phase that needs it. |
| Access modes | The mode goes in the field's type as a flavor (`Editable<T>`, `CreateOnly<T>`, …) and in the `@Prop` option. A strict `@Prop` wrapper fails compilation when they disagree in either direction. Verified (T2). |
| Unmarked field | **Hidden and never writable (security first).** An unmarked field appears in no request and no response. A field is writable only when it says so (`Editable<T>`, `CreateOnly<T>`, `UpdateOnly<T>`, `WriteOnly<T>`). It is readable only when it says so (`Readable<T>`, `Id<T>`, `Tenant<T>`, or a writable preset that also reads). |
| PATCH semantics | A key that is sent replaces the stored value: `null` clears a nullable field, and arrays are replaced. A key that isn't sent is left alone, and defaults never fire on update (C1). A field can declare other behavior with `patch: 'merge' \| 'append'`. |
| Requests | **Strict.** An unknown field, or a field the operation can't write, is a 422 that names the field. |
| Tenancy | **Everything a tenant owns, and shared data, is reached only in the context of a tenant.** A user's own `'account'` rows (profile, MFA factors) are the one kind of data outside every tenant. The app names its tenant resource (Organization, Project, Workspace…), and the header, context key and field name derive from that name. The tenant id travels in a header (`X-Organization-Id`), never in the path. It defaults from the principal when the principal is bound to one tenant. Parent resources other than the tenant stay in the path. Rows that no tenant owns (shared reference data) are still read through a tenant context plus an access rule, usually an entitlement. There is one tenant level. Nested tenants are deferred. The only endpoints outside a tenant are the ones that can't have one: public ones (sign-in) and the signed-in user's own account. Each is an explicit endpoint scope (1.3). Staff work across tenants through `apps-cli`, not the API. |
| Authorization | **Access maps declared in `common` are the default.** They support ordered roles, optional named permissions, conditional rules (a rule may depend on the request), field-level write rules, ownership rules and entitlements. The server and the UI evaluate the same declarations. Hand-written checks stay easy: the access map yields middleware (`requireAccess('ADMINISTRATOR')`), and `defineMiddleware` covers anything else. |
| Principals | `ctx.principal` is one of a user, API key, agent or service, provided by a system `authenticate` step. The union has a `kind`, so bots and staff can be added later without rework. |
| Packaging | The `apps` root entry and every kit's contract subpath are browser-safe (zod and foundation only). Adapters live in subpaths with their library as an optional peer. foundation's root is browser-safe too; its env system moves to `@epsilon-asi/foundation/env`. |
| foundation env move | Accepted as a breaking change. command-line, apps, system and langgraph are updated in the same change. |
| Module format | Every package is ESM. `apps` uses vitest, like command-line. |
| Handlers | The app writes typed handlers, and extensions (mikro-orm) can supply defaults. Handlers are group-bound and take one options object: `handler(Endpoint, { use?, handle })` (C5). `consumer` and `defineMiddleware` have the same shape. |
| Envelope | `{ code, data, message? }` on success, with `data` required whenever the endpoint declares a response. `{ code, error, issues?, traceId }` on failure, so every failure carries the request's `traceId`. maxleads compatibility is not required. |
| Lists | Paging (offset or cursor), sort and filter, with a MikroORM-shaped `where`/`orderBy` object. |
| Naming | maxleads names, derived: `export const { CreateOffering, … } = endpoints(Offering, { name: 'Offering' })`. |
| Relations | Designed in full here. Parent scoping is built with the core; references between resources are built with mikro-orm. |
| Ownership | The structured logger and all five casing helpers move to foundation in Phase 0. command-line's typed middleware chain moves to foundation and is shared. It moves in Phase 2, while the HTTP binding is built, so the generic core is designed against two real users. |
| React | `@epsilon-asi/ui` holds the form, query, field and kit UI layer. TanStack Query sits underneath as the cache, and callers never import it. |
| Databases | **An app runs on Postgres wherever it runs: local dev and production.** Production is configured only with a connection URI and credentials. This repo never provisions production databases. Local dev gets Postgres (and Redis) from a framework dev command. Unit and integration tests may use in-memory SQLite, for example the MikroORM adapter's own tests. Anything that depends on Postgres behavior (pgvector, jsonb, `ilike`, row locks, migrations) is tested against Postgres. Local end-to-end tests run against a real Postgres. Outside tests, the runtime refuses a non-Postgres driver. |
| i18n | **Required.** All UI text is message keys from day one. Field label keys derive from resource and field names, so most call sites pass none. |
| Streaming | **In scope.** `stream` is an endpoint kind (SSE). LLM token streams are its first user. |
| Agent tools | **In scope.** Endpoints turn into tool definitions, with JSON Schema built from the wire schemas, so agents can call the backend as a principal under the same access rules. |
| Security | A first-class requirement. Every rule under "Security requirements" has a named test. |
| IDs | **uuid v7, generated in code** when a row is created, so an id exists before the flush and ids sort by creation time. The database sets no default. |
| Cloud | **Provider-agnostic.** Each cloud-backed concern is an abstract base class, and each provider is a subclass in its own subpath, with its SDK as an optional peer. Messaging ships GCP (Pub/Sub) first; AWS (SNS and SQS) is deferred. Key management ships only its environment-backed default at first, and file storage is deferred. Adding a provider adds a subclass and changes no call site. See "Cloud providers". |
| Identity | **Built in-house, with no auth vendor and no auth framework.** Passwords, OIDC sign-in (Google first) and MFA (TOTP plus recovery codes) all ship in the first identity release. Enterprise SSO (SAML) and SCIM are tabled. |
| Sessions | **Bearer tokens, as in maxleads. No cookies, and no session data in Postgres.** Sign-in returns a short access token and a rotating refresh token. Session state lives in Redis. Tokens travel only in the `Authorization` header, so one API serves the UI and outside callers. Tokens are opaque and checked in Redis on every request, so a revoked session stops at once and there are no signing keys to manage. |
| Public API | **The API the UI calls is the public API.** There is one surface. Outside callers use the same endpoints with an API key, under the same access rules, validation and limits, so nothing is built twice (2.9). |
| Signatures | Sketched functions follow the philosophy doc: one subject, then one options object. That includes `handler`, `consumer` and the `ResourceService` methods (`service.update({ ctx, id, patch })`). |
| Local pub/sub | Local dev uses Google's Pub/Sub emulator, started by `dev`. The Redis Streams transport meant for other providers' local dev waits until another provider lands. |
| API versioning | **In scope.** Changes are additive by default, and CI fails on an undeclared breaking change (2.10). A version is a date, declared once and sent in a header, so URLs never change. Pinning callers to a version, deprecation dates and old-version support arrive with the first breaking change. |
| ORM mapping | **Server-only.** `defineEntity` derives table, column and index names, so most resources declare nothing, and none of it ships to the browser. |
| Identity resources | Apps extend base classes (`class Organization extends TenantResource`), and the generator writes only the subclass files. Spike S6 confirms it. |
| First release | **Lean.** The features under "Deferred features" wait. Each keeps a seam now, so it can be added later without reworking the core, and each design is kept in the appendix. Pub/sub topics ship with GCP only. |
| Connected accounts | **Deferred.** When they land: in-house, with encrypted fields plus refresh locks behind a provider interface, so a vendor can be added later without touching call sites. |

### Open decisions

None. Every numbered decision is settled, and each is recorded in the table above.

| # | Decision | Settled as |
|---|---|---|
| D1 | React data layer | TanStack Query under our own API |
| D2 | Where ORM mapping lives | server-only `defineEntity` |
| D3 | When the middleware chain moves into foundation | in Phase 2, with the HTTP binding |
| D4 | How apps get identity resources | base classes that apps extend |
| D5 | Session transport | bearer tokens, no cookies |
| D6 | Connected-accounts backend | in-house, when it lands (deferred) |
| D7 | Unmarked fields | hidden |
| D8 | Cloud | provider-agnostic base classes |
| D9 | ID generation | uuid v7 in code |
| D10 | MFA | TOTP plus recovery codes, in the first identity release |
| D11 | Nested tenants | deferred |
| D12 | Token format | opaque, checked in Redis on every request |
| D13 | Pub/sub for local dev | Google's emulator; a Redis transport for other providers arrives with them |
| D14 | Handler shape | one options object: `handler(Endpoint, { use?, handle })` |
| D15 | API version naming | a date, sent in a header; per-key pinning arrives with the first breaking change |

Two of these are confirmed by a spike before code depends on them: the handler typing (S0) and base-class inheritance (S6). Each has a stated fallback.

### maxleads patterns kept on purpose (even where they look inconvenient)

- **The flat `Request`.** It holds params, query, header and body fields as siblings, so one object is the form model, the server validator and the handler input. The page supplies parent route params through form defaults, and the layer splits the object into wire sections by field location. This was `destruct()`. The tenant id is not a form value: the client sends it from the tenant context.
- **The contract lives in `common`.** Each runtime attaches only its own pieces. Server-only concerns (handlers, ORM hooks, secrets) never enter `common`. Access rules do live in `common`, because the UI evaluates them too.
- **Endpoint objects with fixed member names** (`Request`, `RequestContent`, `Response`, `ResponseData`, `ResponseTypeUnion`, `Path`, `Method`, `Route`, `Call`), so one import gives everything.
- **Factories return objects that are destructured into the same names in every file** (`FormProvider`, `SubmitButton`, `useFormContext`, `OfferingsProvider`, `useOfferings`).

### What has been verified (review §9)

- **Verified:**
  - Flavored types accept plain values. Exact create, update and read key sets come out of a class; optional modifiers survive only with homomorphic mapping (`[K in keyof C as …]`).
  - A strict `@Prop` with `const` generics catches every flavor/option mismatch both ways.
  - Template-literal endpoint keys, path-param extraction, and dot-path list caps → nested `Where` types all work. Eight resources of 60 fields with cyclic dot paths check in 0.33 s on TS 5.9 and 0.07 s on TS 7.
  - react-hook-form's `FieldPath` works on flavored request types.
  - MikroORM's `FilterQuery` accepts flavored classes and rejects wrong operands.
  - The class-name check survives esbuild minification.
  - The group-bound handler shape types `ctx` from both group and route `use`, on TS 5.9 and TS 7 (T12). That check used a trailing function. The options-object form the plan now uses is re-checked in spike S0.
- **Refuted, and fixed in this plan:**
  - Default detection through `z.input`/`z.output` → structural detection (1.1).
  - `.partial()` update schemas fill defaults → defaults are unwrapped for update (C1).
  - Nested projection leaks → per-operation variants (C2).
  - A cast-free generic ORM translator → one stated internal cast (M6).
  - foundation's root is browser-safe → 0.1.
  - foundation compiles on TS 7 → 0.0.
  - `routes()` types per-route `use` → group-bound handlers (C5).
  - type-bridge handles flavored types → Python comes from JSON Schema, or flavors are stripped first.
- **Versions:**
  - express 5.3.0 and @mikro-orm/core 7.1.4.
  - zod is skewed: 4.4.2 at the root, 4.4.3 in apps, 4.6.7 in foundation's dev install. foundation's peer range is `^4.0.0`.
  - 0.0 settles one zod version and raises the peer floor to the first release with codecs.

### Security requirements

These are the things maxleads got wrong, plus the defaults a production SaaS needs. The framework makes each one impossible or safe by default, and each has a named test (see "Verification").

1. **Tenant isolation by construction.** Every query carries the tenant constraint, including one a hand-written handler runs on `ctx.em`, because the constraint is a filter on the request's entity manager and not a habit of the service (3.1). Parent path params must belong to the tenant, and another tenant's id there is a 404. Every reference id in a body must belong to the tenant too, and another tenant's id there is a 422 on that field, the same answer as for an id that doesn't exist. (maxleads looked up messages, threads and meetings by id alone.)
2. **Safe query decoding.** The bracket decoder rejects `__proto__`, `constructor` and `prototype`, and builds null-prototype objects. Context values come only from middleware, never from request data. (maxleads' decoder allowed prototype pollution into `context.membership`.)
3. **Passwords use argon2id.** Accounts created through SSO have no password, and password sign-in fails for them. (maxleads used HMAC-SHA512 and the sentinel password `"GOOGLE"`.)
4. **Tokens are random and stored hashed.** This covers access and refresh tokens, verification, reset and invitation tokens, recovery codes and API keys. They expire, and they're single-use where that applies.
5. **No unauthenticated routes except those declared `public`.** `createApi` refuses to start otherwise. Health routes and webhooks are public by construction: health reveals nothing, and a webhook's signature verifier authenticates it. There are no open proxies: the future `proxy` kind requires an allow-list.
6. **Outbound HTTP clients are instances.** Each has its own base URL and headers, and nothing is set on a global default. (maxleads leaked Recall's token to Google through axios defaults.)
7. **Errors never return database `detail`, stack traces or internal messages.** A 500 carries a `traceId` only.
8. **Webhooks check timestamps and signatures.** Timestamp tolerance, every signature checked, constant-time comparison, event-id dedup.
9. **Limits are on by default:** body size, uploads when they land, and rate limits keyed on the principal, with stricter limits on auth endpoints.
10. **Authentication runs before the body is decoded,** so a 401 always comes before any 422.
11. **Unmarked, write-only, internal and secret fields never leave the server.** They never appear in responses, messages, logs or audit records, including when nested.
12. **Secrets at rest are encrypted with rotatable keys** and redacted from logs. This covers the TOTP secret and third-party credentials.
13. **Admin endpoints require auth,** as will `/metrics` when the metrics follow-up lands, and `/health/live` and `/health/ready` reveal nothing.
14. **Browser defaults are on, and the API uses no cookies.** There is a CORS allow-list and security headers. Credentials travel only in the `Authorization` header, so a cross-site request has nothing to ride on. No session token or API key ever appears in a URL, and an emailed one-time token rides in the URL fragment, which is never sent to a server.
15. **Cache keys are tenant-scoped,** so a cache entry can't cross tenants.
16. **Session checks fail closed.** A revoked session stops working on its next request. If the session store can't be reached, the answer is 503, never a pass.
17. **Lasting access needs a signed-in person.** Only a user can add a member, an owner, an invitation or an API key. A key and an agent can't.

---

## Architecture

### Layers and owners

| Layer | Package / entry | Depends on | Owns |
|---|---|---|---|
| Base | `@epsilon-asi/foundation` (ESM; browser-safe root) | zod (peer) | Decorator registries, the type registry and extensions, `naming`, structured `logging`, `chain`. Subpaths: `/env` (env system, dotenv), `/files`. |
| CLI | `@epsilon-asi/command-line` | foundation | The CLI binding of `chain`; its public API is unchanged. |
| Model & contracts | `@epsilon-asi/apps` (root) | foundation, zod | The resource system, access flavors, tenancy, access maps and principal types, field extensions, endpoints (crud, action, transition, stream), state machines, list query, wire codec, responses and errors, client, message and job contracts, agent tool definitions. **Browser-safe.** |
| Runtime | `@epsilon-asi/apps/runtime` | foundation (`/env`), Node built-ins | Application lifecycle: ordered services, signals, graceful drain, liveness and readiness. |
| HTTP | `@epsilon-asi/apps/express` | express (optional peer) | The HTTP binding of `chain`; the `authenticate`, `tenant` and `access` system steps; routes; the request pipeline; security defaults; rate limiting; webhooks; SSE streams; `createApi`/`runApi`; in-process tool invocation. |
| ORM | `@epsilon-asi/apps/mikro-orm` | @mikro-orm/core, @mikro-orm/migrations (optional peers) | Entity schemas, the typed query translator, resource services with tenant filters, a transactional unit of work, default handlers, migrations, encrypted fields, ORM error mapping. |
| Secrets | `@epsilon-asi/apps/secrets` | Node crypto | The key ring, rotation, and the `KeyProvider` base class with its environment-backed default. Cloud KMS subclasses are deferred. |
| Redis | `@epsilon-asi/apps/redis` | redis (optional peer) | Typed cache, locks, the session and token store, the rate-limit store. |
| Messaging | `@epsilon-asi/apps/pubsub`; provider `/pubsub/gcp` | the ORM layer (outbox and ledger); `@google-cloud/pubsub` (optional peer) | Typed publish, consumers on the chain, the failure policy, dead-letter defaults, idempotency, the outbox, and the `PubSubTransport` base class with its in-memory subclass. Each provider subpath holds one subclass. |
| Jobs | `@epsilon-asi/apps/jobs` | the ORM layer | Postgres-backed delayed and cron jobs, workers, the job and dead-letter admin endpoints. |
| Testing | `@epsilon-asi/apps/testing` (dev only) | the layers above | `createTestApp`, `as()`, factories and seeds (2.11, 3.10). |
| Kits | `@epsilon-asi/apps/{identity,notifications,billing,metering,audit}`, each with a `/server` half | the layers above, plus their own optional peers (stripe, mail transports) | Identity and accounts, tenant deletion, email, billing and entitlements, usage metering, audit log. Each kit's contract entry is browser-safe; its `/server` entry is Node-only. |
| React | `@epsilon-asi/ui` | apps (browser-safe entries), react, MUI, react-hook-form, TanStack Query | Forms, query and resource contexts, fields, DataTable, `useCan`, the i18n provider, kit UI (auth pages, membership management, jobs admin). |
| Tooling | `@epsilon-asi/apps-cli` (new; built on command-line) | command-line, apps | `new app`, `generate …`, `migrate …`, `dev` (local Postgres, Redis and the Pub/Sub emulator only), `api check`, `secrets check`, `seed` (dev only), and the staff commands (`user`, `tenant`, `jobs`). Its commands arrive with the phases that need them (see "Program order"). |

Enforced in CI: browser-safe entries (foundation's root, `apps`' root and the kit contract entries) import no Node built-ins and no Node-only subpath. The check is in "Verification".

### Cloud providers

Nothing above the adapters knows which cloud it runs on. Each cloud-backed concern has one abstract base class in a provider-neutral entry. The base class holds everything that isn't provider-specific, and a provider subclass implements only a few primitive methods.

| Concern | Base class | Cloud subclasses at first | Local and tests |
|---|---|---|---|
| Messaging (Phase 5) | `PubSubTransport` | `GcpPubSubTransport` (Pub/Sub). AWS is deferred. | `MemoryPubSubTransport` in tests, and Google's Pub/Sub emulator in local dev. |
| Key management (3.7) | `KeyProvider` | none at first; Cloud KMS and AWS KMS subclasses are deferred | `EnvKeyProvider`, the default, which needs no cloud |

- **One setting names the provider.** Each concern reads its provider from the environment (`PUBSUB_PROVIDER`, `KEY_PROVIDER`) and loads that subpath with a dynamic import, so the other cloud's SDK is never loaded. Passing an instance wins. `publish`, `consumer` and `Secret` fields never name a provider.
- **Defaults:** `KEY_PROVIDER` defaults to `env`, and `PUBSUB_PROVIDER` to `gcp`, the only messaging provider so far.
- **Subclasses declare their limits** (maximum message size, maximum delay, ordering support), and the base class checks them before it calls the provider.
- **One conformance suite per base class.** Every subclass must pass it: the in-memory or local subclass in unit tests, and each cloud subclass against that cloud's emulator in integration tests.
- **Adding a provider** means one new subclass in one new subpath. No base class, kit or call site changes.
- **Already neutral:** Postgres (a URI), Redis (a URL), email transports (6.5) and tracing (`traceparent`). Secrets reach the app as environment variables, which every platform's secret manager can inject.
- **Naming:** `<Provider><Concern>`, exported from `@epsilon-asi/apps/<concern>/<provider>`.

### One resource, end to end (target call sites)

```ts
// common/src/app.ts — once per application
export const { Resource, Prop, endpoints, endpoint, defineStateMachine, transitions, Access } =
  createResourceSystem({
    tenant: () => Organization,                               // header X-Organization-Id, ctx.organization, ctx.membership
    roles: ['VIEWER', 'EDITOR', 'ADMINISTRATOR', 'OWNER'],    // ordered, lowest first
  });
```

```ts
// common/src/resources/Offering.ts — shared by API, UI and workers
@Resource()                                       // owned by the tenant: every read and write is scoped to it
export class Offering {
  @Prop.uuid({ crud: 'id' })
  id!: Id<string>;

  @Prop.uuid({ crud: 'tenant' })
  organizationId!: Tenant<string>;                // set from the tenant context, never from the request

  @Prop.string({ crud: 'editable', min: 1 })
  name!: Editable<string>;                        // label key derived: offering.name

  @Prop.string({ crud: 'editable', ui: { multiline: true } })
  description!: Editable<string>;

  @Prop(z.array(z.url()).default([]), { crud: 'editable' })
  links!: Defaulted<Editable<string[]>>;

  @Prop.enum(OfferingType, { crud: 'createOnly' })
  type!: CreateOnly<OfferingType>;

  @Prop.enum(OfferingStatus, { crud: 'readable', default: OfferingStatus.DRAFT })
  status!: Defaulted<Readable<OfferingStatus>>;   // visible, and changed only by OfferingLifecycle

  @Prop.string()
  vectorStoreId!: string;                         // unmarked, so hidden: in no request and no response

  @Prop.date({ crud: 'readable' })
  createdAt!: Readable<Date>;

  @Prop.date({ crud: 'readable' })
  updatedAt!: Readable<Date>;
}

export const { CreateOffering, GetOffering, UpdateOffering, DeleteOffering, ListOfferings } =
  endpoints(Offering, {
    name: 'Offering',
    access: { read: 'VIEWER', write: 'EDITOR', delete: 'ADMINISTRATOR' },
    list: {
      sort: ['name', 'createdAt', 'updatedAt'],
      filter: { type: ['$eq', '$in'], status: ['$eq', '$in'], name: ['$ilike'], createdAt: ['$gte', '$lte'] },
    },
  });
// paths: /offerings and /offerings/:offeringId; the tenant comes from the X-Organization-Id header

export const OfferingLifecycle = defineStateMachine(Offering, {
  field: 'status',
  transitions: {
    publish: { from: [OfferingStatus.DRAFT], to: OfferingStatus.ACTIVE },
    archive: { from: [OfferingStatus.ACTIVE], to: OfferingStatus.ARCHIVED, access: 'ADMINISTRATOR' },
  },
});
export const { PublishOffering, ArchiveOffering } = transitions(OfferingLifecycle, { name: 'Offering' });
```

```ts
// api/src/routes/OfferingRoutes.ts — server-only pieces attached to the contract
export const OfferingRoutes = routes({ handlers: [
  handler(CreateOffering, { handle: async (request, ctx) => {   // request: { name; description; links?; type }
    ctx.logger.info('created offering', { name: request.name, organizationId: ctx.organization.id });
    return exampleOffering(request, ctx);            // a stub ReadModel; returning nothing is a type error here
  } }),
  handler(ListOfferings, { handle: async (request, ctx) => {   // request.where / request.orderBy typed by the list declaration
    ctx.logger.info('listed offerings', { page: request.page });
    return { offerings: [], count: 0 };
  } }),
  // GetOffering, UpdateOffering, DeleteOffering, PublishOffering, ArchiveOffering …
] });

// api/src/main.ts
await runApi({ routes: [OfferingRoutes] });
```

Authentication, tenant resolution, access checks, validation and projection all come from the declarations. A handler sees only a request that is authorized and validated.

Middleware for some routes binds through a group, and `ctx` is typed from both the group's `use` and the route's `use`:

```ts
const offerings = group({ use: [requireFeature('offerings')] });
export const OfferingRoutes = offerings.routes({ handlers: [
  offerings.handler(CreateOffering, { use: [checkQuota], handle: async (request, ctx) => { /* ctx.quota typed */ } }),
  offerings.handler(ListOfferings, { handle: async (request, ctx) => { /* … */ } }),
] });
```

```ts
// ui/src/forms/offering/create-offering.tsx
export const { FormContext, FormProvider, useFormContext, useFormSubmit, SubmitButton, Field } =
  CreateFormContext(CreateOffering, { defaults: { name: '', description: '' } });
// <FormProvider onSuccess={...}><Field name="name" /> ... <SubmitButton /></FormProvider>
// Labels come from i18n keys; the tenant header comes from the client's tenant context.
```

Once the ORM is in, a pure-CRUD resource needs no handlers at all:

```ts
export const OfferingRoutes = routes({ handlers: [
  crudHandlers(Offering),                              // from @epsilon-asi/apps/mikro-orm
  handler(UpdateOffering, { handle: async (request, ctx) => { /* a hand-written handler wins over the default */ } }),
] });
```

### Pattern naming conventions (documented in `packages/apps/docs/CONVENTIONS.md`)

| Thing | File | Export(s) |
|---|---|---|
| Application system | `common/src/app.ts` | `{ Resource, Prop, endpoints, endpoint, defineStateMachine, transitions, Access } = createResourceSystem({...})` |
| Resource | `common/src/resources/<Entity>.ts` | `class <Entity>`; `{ Create<Entity>, Get<Entity>, Update<Entity>, Delete<Entity>, List<Entities> } = endpoints(<Entity>, …)` |
| State machine | `common/src/resources/<Entity>.ts` | `<Entity>Lifecycle`; `{ <Verb><Entity>, … } = transitions(<Entity>Lifecycle, …)` |
| Factories | `api/test/factories/<Entity>Factory.ts` | `<Entity>Factory` via `defineFactory` |
| Seeds | `api/src/seeds/<Name>.ts` | `<Name>Seed` via `defineSeed` |
| Action endpoint | `common/src/resources/<Entity>.ts` (or `common/src/endpoints/<Entity>/<VerbNoun>.ts` when large) | `export const <VerbNoun> = endpoint({ … })` |
| Endpoint members | — | `Name`, `Kind`, `Method`, `Path`, `Access`, `Request`, `RequestContent`, `Response`, `ResponseData`, `ResponseTypeUnion`, `Route`, `Call`, `toContent`, `fromContent` |
| Endpoint types | — | `RequestOf<typeof X>`, `RequestContentOf`, `ResponseOf`, `ResponseDataOf`, `ResponseTypeUnionOf`; plus `ReadModel<typeof E>`, `CreateInput`, `UpdateInput`, `ListQueryOf<typeof ListX>` |
| Errors | `common/src/errors/<Domain>.ts` | `<Domain>Error` (`.Types`, one class per type), union `<Domain>Errors` |
| Jobs | `common/src/jobs/<Job>.ts` | `<Job>` via `defineJob`; handler `<Job>Handler` |
| Topics | `common/src/topics/<Topic>.ts` | `<Topic>` via `defineTopic`; handler `<Topic>Handler` |
| Events | `common/src/events/<Domain>.ts` | `<Domain>Events`, `<Domain>Event` via `defineEvents` |
| Meters | `common/src/meters.ts` | `<Name>Meter` via `defineMeter` |
| HTTP middleware | `api/src/middleware/<concern>.ts` | camelCase value (`checkQuota`); role checks come from `requireAccess('<ROLE>')` |
| Routes | `api/src/routes/<Entity>Routes.ts` | `<Entity>Routes = routes({ handlers: [handler(…), …] })` |
| Large handlers | `api/src/handlers/<Entity>/<Endpoint>.ts` | `<Endpoint>Handler = handler(<Endpoint>, …)`, listed in `<Entity>Routes` |
| Services (ORM) | `api/src/services/<Entity>Service.ts` | `class <Entity>Service extends ResourceService(<Entity>)` |
| Forms | `ui/src/forms/<entity>/<verb>-<entity>.tsx` | `FormContext`, `FormProvider`, `useFormContext`, `useFormSubmit`, `SubmitButton`, `Field` |
| List context | `ui/src/context/<entities>.tsx` | `<Entities>Provider`, `<Entities>Context`, `<Entities>Consumer`, `use<Entities>` |
| Single context | `ui/src/context/<entity>.tsx` | `<Entity>Provider`, `<Entity>Context`, `use<Entity>` |
| Tenant | — | header `X-<Tenant>-Id`, context `ctx.<tenant>` and `ctx.membership`, field `<tenant>Id`, all derived from the tenant resource's name |
| Provider adapter | `<concern>/<provider>/` | `<Provider><Concern>` (`GcpPubSubTransport`), from `@epsilon-asi/apps/<concern>/<provider>` |
| Route params | — | `:<entity>Id` for the item, `:<parent>Id` for a parent scope |
| Paths | — | `/<kebab-plural>`, `/<kebab-plural>/:<entity>Id`, under `/<parent-kebab-plural>/:<parent>Id` when a parent is given |
| Message keys | — | `<entity>.<field>` (label), `<entity>.<field>.placeholder`, `<entity>.<field>.<VALUE>` (enum option), `errors.<Domain>.<TYPE>` |

**Name rules.** Names are PascalCase with no consecutive capitals (`ApiKey`, not `APIKey`). That way type-level `Uncapitalize` and runtime `toCamelCase` agree. The plural defaults to `` `${name}s` ``, with a definition-time warning for names ending in s, x, y, ch or sh unless `plural` is given (Company → Companies).

Definition-time checks keep the naming honest. Each throws an error that names the offender:

- `endpoints()`'s `name` literal is the source of truth. In development and test builds, it must equal the class name. (Minifiers other than esbuild aren't verified to keep class names.)
- Two routes can't share a method and path.
- Every path param must map to a request field.
- A tenant-owned resource has exactly one `Tenant` field, named `<tenant>Id`.
- Every role, permission and entitlement named in an access rule exists.

---

## Phase 0 — Toolchain and foundation prep

### 0.0 Toolchain
- **pnpm workspaces:**
  - A root `pnpm-workspace.yaml` with `packages/*`.
  - Inter-package dependencies use `workspace:^`.
  - The per-package `package-lock.json` files go, replaced by one root lockfile.
- **Root scripts:** `build`, `test` and `typecheck` run through `pnpm -r`, in dependency order. That replaces `scripts/run_for_packages.sh`. `release.sh` and `bump_version.sh` stay; `release.sh` publishes with pnpm, which rewrites `workspace:` ranges to real versions.
- **CI (`validate.yml`):** one `pnpm install`, then typecheck, test and build in dependency order, so `apps` builds against foundation's source (M1).
- **foundation's tsconfig:** ESM with `module`/`moduleResolution: nodenext`. It compiles on TS 5.9 and TS 7; TS 7 rejects the current `moduleResolution: node`.
- **Type tests run in CI:** type tests (`*.type-test.ts`, `*.test-d.ts`) are part of `typecheck` in every package (M2).
- **zod:** one version across the workspace. foundation's peer floor rises to the first zod release with `z.codec`.
- **Done when:** `pnpm -r typecheck test build` passes on TS 5.9 and TS 7, with no npm release in between.

### 0.1 Browser-safe foundation
- foundation ships ESM with `sideEffects: false`.
- The root exports only the decorators, types, naming and logging. The chain joins them in Phase 2. `/env` (the env system and dotenv) and `/files` are subpaths (C4).
- **Every importer of the env exports moves in the same change:** command-line, apps, system and langgraph import `loadEnv`, `Env`, `EnvVar`, `createEnvSystem` and friends from `@epsilon-asi/foundation/env`.
- `check:browser` runs in foundation. It bundles the root with esbuild (`platform: 'browser'`) and scans the metafile for Node built-ins.

### 0.2 Logging and naming into foundation
- **Move** these from `packages/command-line/src/logging.ts` and `naming.ts` to `packages/foundation/src/logging/` and `packages/foundation/src/naming/`:
  - `Logger`, `LogLevel`, `LOG_LEVELS`, `DEFAULT_LOG_LEVEL`, `isLogLevel`, `createLogger`
  - `toKebabCase`, `toScreamingSnakeCase`
- **Structured logging (M9):**
  - `Logger` methods take `(message, fields?)`.
  - `child(bindings)` creates a bound logger.
  - Errors are serialized.
  - Fields are redacted by key name, and through a redaction hook. `apps` fills the hook with every server-only field (1.1), because foundation doesn't know about flavors.
  - A JSON writer takes its field names from a format preset: generic (`level`, the default) or `gcp` (`severity`).
  - The CLI keeps its text writer.
- **Casing:** `toCamelCase`, `toPascalCase` and `toSnakeCase` ship now, with round-trip tests across all five. Phase 1 derives item params, list keys and message keys from them.
- **Stays in command-line:** the CLI-specific pieces (`logLevelEnvName`, `commandNameFromClass`, `optionFlags`, `parseFlags`, `argumentSyntax`, the `DEFAULT_LOG_LEVEL_*` flag constants).
- command-line re-exports the moved names, so its public API and tests stay unchanged.

### 0.3 The typed middleware chain (built in Phase 2)
This work runs with 2.2, not in Phase 0, so the generic core is designed against two real users: the CLI and HTTP. It stays written here because it changes foundation and command-line.
- **Source:** command-line's `middleware/{define,compose,types,resolve}.ts`.
- **The generic core is generic over six things (M8):**
  - the base context;
  - the reserved keys;
  - the needed inputs (CLI: flags; HTTP: request fields; messages: none);
  - the stop value (an exit code, a failure response, an ack/nack);
  - the chain result;
  - the terminal run.
- **It includes `resolve.ts`'s ordering and de-duplication.** It keeps one identity set per binding, so a CLI middleware can't be passed to an HTTP route. A layer that needs the same behaviour in several bindings builds one middleware per binding from one implementation.
- **Duplicate provided keys are checked at definition time** from runtime `provides: ['organization']` declarations. Types alone can't check them, because `ProvidedBy` intersects duplicate keys silently.
- **command-line becomes a binding.** It keeps `defineMiddleware({ options })`, `CommandContext`, `Provided`, `ChainResult` and `ValidCommandClass` exactly as they are today.
- **Acceptance:** command-line's existing middleware tests and examples pass unchanged.

### 0.4 Additions to foundation's `@Prop`
- **New shorthands:** `Prop.uuid()`, `Prop.enum(E | values)`, `Prop.email()`, `Prop.url()`, and a `default` option on the shorthands. `default` joins `SHORTHAND_KEYS` (`typeRegistry.ts:71`); otherwise it resolves as an unknown extension and throws. They get type tests in the `typeRegistry.type-test.ts` style.
- **Retire the old prototypes:** `decorators/requests/mapping.ts` and `decorators/validation/validatable.ts`. The `aiTool` intent in `validatable.ts` is carried forward as agent tools (1.12).

### 0.5 Re-tool `@epsilon-asi/apps`
- **ESM build:** `"type": "module"` and `tsconfig.build.json`, matching command-line's TS and vitest versions.
- **Exports map:**
  - `.`, `./runtime`, `./express`, `./mikro-orm`, `./secrets`, `./redis`, `./pubsub`, `./jobs`, `./testing`
  - a provider subpath under `pubsub` (`./pubsub/gcp`)
  - each kit plus its `/server` half
  - `./package.json`
- **Dependencies:**
  - `@epsilon-asi/foundation` (`workspace:^`) and `zod`.
  - Optional peers: `express`, `@mikro-orm/core`, `@mikro-orm/migrations`, `redis`, `stripe`, and the cloud SDK each provider subpath uses (`@google-cloud/pubsub`).
  - Drop `openai`, `dotenv`, `uuid`, `ts-deepmerge` and `@mikro-orm/decorators`.
  - devDependencies: vitest, @types/express, @mikro-orm/sqlite, @mikro-orm/postgresql, esbuild.
- **Remove the placeholders:** `src/{api,consumer,daemon,producer}/index.ts` and `src/common/*`.
- **Scripts:** `build`, `typecheck` (including type tests), `test`, `check:browser`, `verify`, `bump`, `pub`.

**Phase 0 is done when** `typecheck`, `test` and `build` pass in foundation, command-line, apps, system and langgraph, and `check:browser` passes on foundation's and `apps`' browser-safe entries, all on TS 5.9 and TS 7.

---

## Spikes (about a day each; after Phase 0, before Phase 1)

| Spike | Question | Done when |
|---|---|---|
| S0: route typing | Does `handler(Endpoint, { use, handle })` type `ctx` from group and route `use`, reject wrong returns (including M3's rule on `void`), and reject bad endpoint references? It runs against command-line's chain types and a minimal `Endpoint` stub with 1.4's members, because Phase 1 hasn't built the real ones yet. If `ctx` doesn't type in this form, the fallback is the trailing function, which is verified (T12). | The T12 matrix passes on TS 5.9 and TS 7, and the matrix is committed as a type test. It's re-run against the real types once 1.4 lands. |
| S1: derivation | Do PATCH and nested projection behave? | `UpdateX.Request.parse(oneKey)` returns that key only. A server-only field (unmarked, `Internal`, `WriteOnly` or `Secret`), nested or not, never appears in a response, a message or a log. |
| S3: MikroORM | Do `em.create`, `assign`, serialization, array/json operators, `FilterQuery` and tenant filters work with flavored classes? | `ResourceService.create` compiles with one stated cast, and `EntityOf<C>` makes `ctx.em.create` correct. Runs on SQLite and Postgres. |
| S4: tenancy and access | Does every ownership kind scope correctly from declarations alone? They are Offering (owned), SalesThread (owned, under a parent campaign), Channel (owned with a user owner) and Company (shared, behind an entitlement), plus the tenant itself (`'self'`) and an `'account'` row (`MfaFactor`). Do conditional rules give the same answer on the server and in the UI? | Org A can't read or write org B's rows in any case, a user can't reach another user's `'account'` rows, and no case needs a hand-written handler. |
| S5: shutdown | Does an Express 5 drain work with keep-alive clients, with readiness flipping first? | An in-flight request completes, new connections are refused, and the process exits before the timeout. |
| S6: resource inheritance | Do decorated fields inherit through `class Organization extends TenantResource`, with the strict `Prop` and derived types intact? Can a subclass be stopped from loosening an inherited field, for example making a hidden field `Readable`? | Confirms the base-class approach. If it fails, the fallback is generated copies. |

S2 from the review (foundation packaging) became Phase 0.0 and 0.1.

---

## Phase 1 — Core: model and contracts (browser-safe)

### 1.1 Resource system (`apps/src/model/`)
- **`createResourceSystem(options)`** follows the `create*System` pattern and builds on `createTypeRegistry({ namespace: 'resources' })`. Its options:
  - `tenant`: the tenant resource as a thunk, or `{ resource, header?, field?, context? }` to override derived names. Omit it for an app without tenancy.
  - `roles`: ordered tenant roles.
  - `permissions?`: named permissions mapped to roles.
  - `features?`: entitlement names, so `feature('x')` rules are checked at definition time. The billing kit's `definePlans` is typed against them.
  - `apiVersion?`: the current API version, a date (2.10). `api check` requires it to move forward whenever a breaking change is declared. Default: none, which turns the version header and pinning off; `api check` still guards changes.
  - `access?`: the default access for endpoints that declare none. Default: every operation requires the highest role, so forgetting `access` fails safe.
  - `extensions?`

  It returns `{ Resource, Type, Prop, ref, endpoints, endpoint, defineStateMachine, transitions, Access, resolve, use }`. The default instance has no tenancy and serves libraries and tests.
- **`@Resource(options?)`** is `@Type` plus resource-level options: `name`, `description`, `mode`, `tenancy` and `owner` (1.3), and type-level extension options. `softDelete` and `versioned` are reserved for the deferred features.
- **Access flavors (`model/access.ts`).** Each axis is a separate phantom key, so flavors compose as intersections.
  - A flavor is null-safe: `Flavor<T, F> = T extends null | undefined ? T : T & F`, distributed over unions, so `Editable<Date | null>` keeps its `null` (M5).
  - The axes are `write`, `read`, `defaulted`, `id`, `tenant` and `secret`.
- **Presets:**

  | Preset | Write | Read | Meaning |
  |---|---|---|---|
  | *(unmarked)* | never | no | hidden: server-only, in no endpoint |
  | `Readable<T>` | never | yes | set by the server and visible to clients (status, timestamps). It isn't named `ReadOnly`, which is one keystroke from TypeScript's built-in `Readonly`. |
  | `Id<T>` | never | yes | primary key, item route param |
  | `Tenant<T>` | never (set from the tenant context) | yes | the owning tenant's id |
  | `Editable<T>` | create and update | yes | |
  | `CreateOnly<T>` | create | yes | |
  | `UpdateOnly<T>` | update | yes | |
  | `WriteOnly<T>` | create and update | no | passwords |
  | `Internal<T>` | never | no | the same as unmarked, written out to state intent |
  | `Secret<T>` | never | no | `Internal`, plus encrypted at rest (3.7) and redacted from logs |
  | `Defaulted<T>` | — | — | the schema has a default; optional on create; composes with the others |

- **Flavors are stripped from derived types** (`RequestOf`, `ReadModel`, `CreateInput`, form values). Brands stay only on the class, so diagnostics read `string`, not `Defaulted<UpdateOnly<…>>` (M5).
- **Server-only fields** are unmarked, `Internal`, `WriteOnly` and `Secret` fields. `serverOnlyFields(C)` lists them, and projection, log redaction, audit and the tests all use that one list.
- **Strict `Prop` (`model/prop.ts`)** wraps foundation's `Prop` and every shorthand with `const` option generics. At compile time it requires:
  - The field's flavor equals the flavor implied by `crud`. Neither means hidden.
  - `Defaulted` is present exactly when the schema has a default. This is detected structurally: the outer wrapper chain contains `ZodDefault` or `ZodPrefault`, and shorthands carry a literal `default` key through `const` generics (M4).
  - Each mismatch produces a diagnostic that names the property.
- **`patch` field option:** `'replace'` (the default), `'merge'` for objects, or `'append'` for arrays.
- **Derived types (`model/types.ts`)** come from the class type alone:
  - `Fields`, `ReadModel`, `CreateInput` (required unless `?` or `Defaulted`), `UpdateInput` (all optional), `IdOf`.
  - `Paths` (dot paths into nested resources, depth-limited).
- **Runtime model.** `resolveResource(C)` caches a `ResourceModel` per class, holding fields with their access, the id field, the tenancy and extension options. It also holds three schema **variants**: `read`, `create` and `update`.
  - A nested `ref` inside a variant points at the *same variant* of its target, so projection reaches nested types (C2). `ReadModel` recurses the same way.
  - `update` is built from each field's schema with the `default`, `prefault` and `catch` wrappers removed before `.optional()`, so an absent key stays absent (C1).
  - Resource-level `refine` runs after the per-operation derivation, because zod can't `pick`/`partial` a refined object.
- **Definition-time errors** (`ResourceDefinitionError`, naming the class and field):
  - no `id` field when CRUD endpoints are requested;
  - two `id` fields, or composite keys (memberships use a surrogate id);
  - an `Internal` or `Secret` field that is also an id;
  - a tenant-owned resource without exactly one `Tenant` field;
- **IDs:** uuid v7, generated in code. `newId()` is exported from the core and uses Web Crypto, so it needs no dependency. Services call it when they create a row, so the id exists before the flush, and ids sort by creation time. The database sets no default.
- **Field helper:** `fields(C, { pick: ['name', 'description'] })` or `fields(C, { omit: [...] })` returns a typed zod object, for facet-update and action endpoints.

### 1.2 Field and type extensions (definitions only, dependency-free)

| Key | Field options | Type options | Consumed by |
|---|---|---|---|
| `crud` | an access preset string, or `{ access?, id? }`; plus `patch?` | — | endpoints, forms, ORM defaults |
| `http` | `{ name? }`, a wire-name override. Location is per operation, not per field: an endpoint option `in: { field: 'query' \| 'header' \| 'body' }`, because the same field is body in Create and query in List. | — | endpoints |
| `ui` | `{ label?, placeholder?, helperText?, input?, autoComplete?, multiline?, order? }`. Text options are message keys that default to `<entity>.<field>[.placeholder\|.helper]`. Enum option labels default to `<entity>.<field>.<VALUE>`. Typed `options` overrides are special-cased in the strict `Prop.enum`, because an extension can't type them against the enum. | `{ label?, plural? }` (keys) | React fields |
| *(no `orm` key)* | — | — | ORM mapping is server-only: `defineEntity` (3.1). Table, column and index names never reach the browser. |

### 1.3 Tenancy, principals and access (`apps/src/tenancy/`, `apps/src/access/`)

**Tenant context.**
- **Names derive from the tenant resource** (`Organization` → header `X-Organization-Id`, `ctx.organization`, `ctx.membership`, field `organizationId`). Each can be overridden in `createResourceSystem({ tenant })`.
- **Resolution order:**
  1. the header;
  2. the principal's bound tenant (API keys and agent tokens are issued for one tenant);
  3. otherwise, 400 `Tenant.REQUIRED`.

  A bound principal's header, when sent, must match its tenant.
- **Membership:** the principal must be a member of the tenant, or bound to it. Otherwise the response is 404, so tenants can't be enumerated.
- **Ownership kinds** (`@Resource({ tenancy })`):
  - `'owned'` (the default when the system has a tenant): the row has the `Tenant` field. The layer filters by it and sets it.
  - **Under a parent:** a row under a parent (SalesThread under its campaign) is still `'owned'`. When it's created, the layer checks that the parent belongs to the tenant and copies the tenant id from it. So the tenant filter is always one column, never a join.
  - `'shared'`: no tenant owns the row (shared reference data such as Company). It still requires a tenant context, and its endpoints must name an access rule, usually an entitlement. Leaving the rule out is a definition-time error. Only Get and List are on by default, because a write would change what every tenant sees. A write operation needs an explicit opt-in. Otherwise shared data changes through seeds, migrations or `apps-cli`.
  - User-owned rows (a user's connected inbox) are tenant-owned rows that declare `@Resource({ owner: 'userId' })`. `own()` defaults to that field.
  - The tenant resource itself is `'self'`, set automatically.
  - `'account'`: the row belongs to one user and sits outside any tenant (the user's own profile, MFA factors). Only that user reaches it; staff reach it only through `apps-cli`. It needs `owner`, or the definition fails.
- **Parent scopes:** `endpoints(SalesThread, { name, parent: SalesCampaign })` gives `/sales-campaigns/:salesCampaignId/sales-threads`. The layer checks that the parent belongs to the tenant (404 otherwise) and constrains the rows to that parent.
- **Workers:** every job and message envelope carries the tenant id, and consumers and jobs run with the same scoping.
- **Nested tenants** (an organization holding projects) are deferred. There is one tenant level.

**Endpoint scope.** Every endpoint has exactly one scope, and the pipeline's `tenant` step runs only for the first.

| Scope | Tenant | Who can call | Used for |
|---|---|---|---|
| `tenant` (the default) | required | any principal its access rule allows | every app resource |
| `account` | none | the signed-in user, for their own data only | `WhoAmI`, `ListMyTenants`, `CreateTenant`, `AcceptInvitation`, `DeleteAccount`, profile, password, MFA and the user's sessions |
| `public` | none | anyone, or the holder of a one-time token the endpoint checks itself | sign-in, refresh, sign-up, email verification, password reset, SSO, MFA verification, `/openapi.json` |

- **Why the exception exists:** a new user has no tenant until `CreateTenant` runs. Staff work across tenants through `apps-cli`, not the API (6.1). The scope value `platform` is reserved for a staff console later.
- **The tenancy rule still holds.** Anything a tenant owns, and shared data, is reached only through a tenant. `endpoints()` gives `tenant` scope unless the resource's tenancy is `'account'`.
- **`account` is never a default.** An endpoint gets one only by saying so, and declaring a resource's tenancy `'account'` counts as saying so for its endpoints.
- **`account` scope reads across tenants for the user only.** `ctx.em` binds the signed-in user instead of a tenant (3.1), so `ListMyTenants` and `DeleteAccount` can read the user's own memberships in every tenant.

**Principals.** `ctx.principal` is a union:
- `UserPrincipal`. Its `actor?` field is reserved for impersonation (deferred); the session record and audit events carry it already;
- `ApiKeyPrincipal`;
- `AgentPrincipal`, which acts on behalf of a user, with the user's permissions narrowed by the agent's grant;
- `ServicePrincipal`, for internal workers.

The system `authenticate` step provides it, using verifiers from the identity kit; apps can add verifiers. The union has a `kind`, so bot and staff principals can be added later without rework.

How each kind meets an access rule:

| Principal | Tenant comes from | Role the rules see |
|---|---|---|
| User | the header | the membership's role |
| API key | the key | the role set when the key was made, never above its creator's, optionally narrowed to named permissions |
| Agent | the token | the user's role, narrowed by the agent's grant |
| Service | the job or message envelope | in-process only (jobs, consumers). It passes role rules, and it never has a bearer token. |

An endpoint can limit the kinds with `principals`. The defaults:
- `tenant` endpoints accept users and API keys.
- Agents reach only endpoints marked `tool: true` (1.12), whether they call in-process or over HTTP.
- `account` endpoints accept users only.
- The identity kit's membership, invitation, API-key, ownership, billing and tenant-lifecycle endpoints accept users only, so a leaked key can't be used to create more access (Security 17).

**Access maps.**

```ts
endpoints(Membership, {
  name: 'Membership',
  access: { read: 'VIEWER', write: 'ADMINISTRATOR', fields: { role: { write: 'OWNER' } } },   // only owners change roles
});

export const ExportOfferings = endpoint({
  name: 'ExportOfferings', method: 'get', path: '/offerings/export', request: ExportRequest, response: ExportResult,
  access: [when({ test: (request) => request.includeArchived, rule: 'ADMINISTRATOR' }), 'EDITOR'],   // conditional, then the default
});
```

- **What a rule can be:** a role, a named permission, `feature('x')` (an entitlement, 6.6), `own()`, `public`, `when({ test, rule })`, `all(...)` or `any(...)`. `staff()` is reserved for the staff console.
- **Rule arrays:** an array applies the first `when` whose predicate matches, otherwise its plain rule.
- **Where it's declared:** per operation in `endpoints()` (`read`, `write`, `create`, `update`, `delete`, `list`), per endpoint in `endpoint()`, and per transition in a state machine. Field-level rules go under `fields`.
- **Server enforcement:**
  - Before the body is decoded, the pipeline checks the minimum role across all of the endpoint's rules. Rules that name no role (`own`, `feature`, `public`) add no floor.
  - `own()` is enforced as a row constraint, not only as a yes or no: a list returns only the caller's rows, and someone else's row is a 404 (3.1).
  - After validation, it checks the full rules: conditional, field-level and ownership (2.4).
- **UI:** `const can = useCan(); can(ExportOfferings, request)`. Field rules disable form fields.
- **Escape hatch:** `requireAccess('ADMINISTRATOR')` is ordinary middleware. It comes from the HTTP binding, built from the access map, because middleware can't live in the browser-safe core. And `defineMiddleware` covers anything else.
- **Definition-time errors:** an unknown role, permission or entitlement; a `shared` resource without a rule; a field rule on a field the operation can't write.
- **Startup error:** a `feature()` rule on an API with no entitlement resolver. The billing kit registers one (6.6).

### 1.4 Endpoints (`apps/src/endpoints/`)

**`endpoints(C, options)`** builds the five CRUD endpoints. Its options:
- `name`: a literal, and the source of truth.
- `plural`: default `` `${name}s` ``, with the warning described above.
- `parent`: a parent resource, for scoped paths.
- `operations`: default all five, or Get and List for a `shared` resource. `{ Delete: false }` turns one off, and `{ Delete: { principals: ['user'] } }` sets options for one.
- `access`.
- `in`: per-operation field locations.
- `list: { sort?, filter?, search?, perPage?: { default, max }, paging?: 'offset' | 'cursor' }`. `search` is 1.13.
- `tool?`: agent tool exposure (1.12).
- `scope`, `principals` and `docs`, as on `endpoint()`. They apply to every operation unless `operations` sets them for one.

Return keys are template-literal types: `` `Create${N}` ``, `` `Get${N}` ``, `` `Update${N}` ``, `` `Delete${N}` ``, `` `List${P}` ``.

**Reserved names.** `bulk` and `restore` can't be path segments or transition verbs, and `softDelete`, `versioned`, `deprecated`, `suspended` and `impersonation` can't be option names. A definition that uses one fails, so the deferred features can arrive without breaking an app.

**The tenant resource's own routes** drop the id: `/organization` instead of `/organizations/:organizationId`, and `POST /organization/<verb>` for its transitions. They act on the tenant from the header, so a path can never name another tenant.

**Path parameters.** The item param is `` `${Uncapitalize<N>}Id` ``, mapped to the id field. A parent param comes from the parent's name. Each maps to a request field, and that field is excluded from bodies. The tenant id never appears in a path.

**Operations:**

| Endpoint | Method | Path | Flat `Request` | Success `ResponseData` | Code |
|---|---|---|---|---|---|
| `Create<E>` | post | `/…/<plural>` | parent params + `CreateInput` | `ReadModel` | 201 |
| `Get<E>` | get | `/…/<plural>/:<e>Id` | parent + id | `ReadModel` | 200 |
| `Update<E>` | patch | `/…/<plural>/:<e>Id` | parent + id + `UpdateInput` | `ReadModel` | 200 |
| `Delete<E>` | delete | `/…/<plural>/:<e>Id` | parent + id | none | 200 |
| `List<P>` | get | `/…/<plural>` | parent + `ListQuery` | `{ <camelPlural>: ReadModel[], count }` (cursor paging: `{ <camelPlural>, nextCursor }`) | 200 |

**`endpoint({...})`** builds one custom or action endpoint with the same members. It takes:
- `name`, `method`, `path`;
- `request`: a `@Type`/`@Resource` class or a zod object;
- `response`: a class, a zod schema, `stream(schema)`, or nothing;
- `code` and `access`;
- `scope` and `principals` (1.3);
- `docs`: default true; false hides it from the OpenAPI document (2.9);
- `tool?`: agent tool exposure (1.12);
- `headers?`: header presets such as `Idempotent`;
- `failures?`, which narrows `ResponseTypeUnion` or adds codes the derivation can't see, such as 401 on the public `RefreshSession`.

The default failures are derived:
- 400, on `tenant`-scope endpoints (a missing tenant);
- 422, always;
- 401 and 403, unless the endpoint is public;
- 402, wherever `requireBudget` or a `feature()` rule applies;
- 404, when the path has params or the endpoint is tenant-scoped;
- 409, on create, update and delete;
- 429, always, because rate limits are on by default;
- 500, always;
- 503, unless the endpoint is public (the session store is down).

Cross-cutting headers (an idempotency key, for example) are endpoint presets declared in `common`, for example `endpoint({ …, headers: Idempotent })`, so the client, forms and OpenAPI see them (C6).

**Endpoint kinds:**
- `crud`, `action` and `transition` (1.5).
- `stream` (SSE, 2.6).
- `proxy({ allow })` is reserved for later. It always needs an allow-list.

**Members on every endpoint:**
- **Contract:** `Name`, `Kind`, `Method`, `Path`, `Access`, `Route`.
- **Schemas:** `Request` is the flat, decoded zod object. `RequestContent` is `{ params, query, body, headers }`, wire-shaped. `ResponseData` and `Response` are the success envelope. `ResponseTypeUnion` is every response the endpoint can send, success and failure.
- **Helpers:** `toContent(request)` and `fromContent(content)`. `Call(request)` takes the flat request, adds the tenant header from the client, and splits the request into sections. A `stream` endpoint's `Call` returns an `AsyncIterable`.
- **Types** come through `RequestOf<typeof X>` and friends. Every type that appears in an inferred signature is exported, or declaration emit fails (T9).

**Handler returns.** A handler returns `ResponseDataOf<E> | Failure`. It may return `void` only when the endpoint declares no response (M3).

**Response projection.** Handler output is parsed through the `read` variant in strip mode, nested types included. Unmarked, `Internal`, `WriteOnly` and `Secret` fields can't leak.

### 1.5 State machines (`apps/src/state/`)
- **`defineStateMachine(C, { field, transitions: { [verb]: { from, to, guard?, access? } } })`** declares the transitions. The field is never writable through CRUD (it's `Readable` when clients should see it), so a PATCH can't change it (M11).
- **`transitions(machine, { name, options? })`** returns action endpoints named `<Verb><Entity>` (`POST /<plural>/:<e>Id/<verb>`). `options` sets endpoint options per verb, for example `{ archive: { principals: ['user'] } }`. It also returns domain events. The worker guard `inState(machine, { states: ['RUNNING'] })` is middleware, so it comes from the messaging and jobs bindings (Phase 5), not from the core.
- **Guards** run on the server. The UI gets `canTransition(machine, { row, verb })`, built from `from` and `access`.

### 1.6 List query (`apps/src/query/`)
- **`ListQuery<C, Caps>`** is `{ page, perPage, where?, orderBy? }`, or `{ cursor?, perPage, where?, orderBy? }` with cursor paging. It adds `q?` when search is declared (1.13).
- **`Where`** is MikroORM-shaped and nested. Each field gets only its declared operators, from:
  - `$eq $ne $in $nin $gt $gte $lt $lte $like $ilike`;
  - `$exists` and `$eq: null` on nullable fields;
  - `$contains`/`$overlap` on array fields.

  `$and`/`$or` nest the same shape. `$like`/`$ilike` exist only on strings; MikroORM's own types allow them on dates, but ours don't.
- **`OrderBy`** is `{ [sortable path]?: 'asc' | 'desc' }`, nested for dot paths, and every key applies.
- **Capabilities are declared once**, in `endpoints(…, { list })`, and type-checked against `Paths<C>`. With nothing declared, there's no sort or filter, only paging. Only fields the caller can read can be filtered or sorted, because a filter on a hidden field leaks its value. Naming an unmarked, `Internal`, `WriteOnly` or `Secret` field is a definition-time error.
- **Exported defaults:** `DEFAULT_PAGE = 0`, `DEFAULT_PER_PAGE = 20`, `DEFAULT_MAX_PER_PAGE = 100`.
- **Query cost is capped.** The depth of a `where`, its number of conditions and the length of an `$in` list each have a limit (`DEFAULT_MAX_WHERE_DEPTH`, `DEFAULT_MAX_WHERE_NODES`, `DEFAULT_MAX_IN_LENGTH`). Going over is a 422.
- **Wire format:** bracket encoding, with one encoder and decoder in core used by both sides. The decoder rejects the keys `__proto__`, `constructor` and `prototype`, and builds null-prototype objects (Security 2).

### 1.7 Wire codec (`apps/src/wire/`)
- **One schema, two directions.** Each variant has a wire form, built by walking the zod definition. The server decodes requests and encodes responses; the client does the reverse. Forms and handlers always see decoded values.
- **The walker contract (M7):**
  - Lazies are memoized, and each recursive node is emitted as a lazy.
  - Registry metadata is copied onto replacement nodes.
  - Booleans use `z.stringbool()`. Numbers use a strict numeric parse, so an empty string is an error, not 0.
  - Dates are `z.codec(z.iso.datetime({ offset: true }), z.date())`.
  - Multipart is reserved in the format, for a `file` field kind later.
- **JSON Schema** (OpenAPI, agent tools) comes from the wire schemas with `io: 'input'`. A decoded `z.date()` has no JSON Schema.
- **Supported kinds:** object, array, optional, nullable, default, enum, literal, union, lazy (`ref`), pipe, codec, and the primitives. Anything else is rejected at definition time with the field's path. Every kind has a round-trip test.

### 1.8 Responses and errors (`apps/src/responses/`)
- **Codes:** `SUCCESS_CODES`, `CLIENT_FAILURE_CODES` and `SERVER_FAILURE_CODES`, each a const plus a same-named type.
- **Success:** `{ code: 200 | 201, data, message? }`. `data` is required whenever the endpoint declares a response.
- **Failures:**

  | Type | Code | Notes |
  |---|---|---|
  | `ValidationFailureResponse` | 422 | `issues: { path, message, code }[]`, with paths that are flat-request field names |
  | `AuthenticationFailureResponse` | 401 | `error` is `Auth.UNAUTHENTICATED`, or `Auth.TOKEN_EXPIRED` when an access token has only expired, so the client knows to refresh |
  | `AuthorizationFailureResponse` | 403 | for members who lack the role or permission; across tenants the answer is 404 |
  | `NotFoundFailureResponse` | 404 | |
  | `ConflictFailureResponse` | 409 | |
  | `ClientFailureResponse` | `Exclude<4xx, 401 \| 403 \| 404 \| 409 \| 422>` | so `code` still discriminates the union |
  | `ServerFailureResponse` | 500 | no detail beyond `traceId` |
  | `UnavailableFailureResponse` | 503 | the session store or another dependency is down; carries `Retry-After` |

- **Handlers never build envelopes.** They return data, return `failure.notFound()` and friends, or throw.
- **`defineErrors('OrgBilling', { UNPAID: { code: 402 }, … })`** produces `OrgBillingError` with `.Types` and the `OrgBillingErrors` union.
  - `error` on the wire is the namespaced type (`OrgBilling.UNPAID`), and the UI translates it through `errors.OrgBilling.UNPAID`.
  - Workers use the same types for their ack/nack policy.

### 1.9 Client (`apps/src/client/`)
- **`createClient({ baseUrl, headers?, tenant?, tokens?, refresh?, version?, fetch? })`** returns an instance with `client.call(endpoint, request)`. `tenant: () => string | undefined` supplies the tenant header. Each instance owns its headers, and nothing is global (Security 6).
- **Tokens.** The client attaches `Authorization: Bearer`, refreshes shortly before the access token expires, and retries once after a 401 `Auth.TOKEN_EXPIRED`.
  - `refresh` is how it refreshes: a `RefreshStrategy`. The core defines only the interface, and the identity kit's contract entry supplies `sessionRefresh`, which calls `RefreshSession`. With no `refresh`, the client never refreshes. This keeps the core free of the kit.
  - `tokens` is where it keeps them (a `TokenStore` with `get`, `set` and `clear`).
  - Default in a browser: the access token in memory and the refresh token in `localStorage`. Default in Node: memory.
  - A caller with an API key passes `tokens: apiKey('…')`.
  - One refresh runs at a time across tabs, under a Web Lock.
- **`version`** is sent as `X-Api-Version`. Default: the `apiVersion` the contract was built with, so the client's types always match what the server answers.
- **`configureClient({...})`** sets the default client used by every endpoint's `Call`.
- **Results:** HTTP failures resolve to the typed `ResponseTypeUnion` member, and only network failures reject.

### 1.10 Message and job contracts (designed here, built in Phase 5)
- `defineTopic(name, { schema })` returns `{ Name, Message, Subscription }`, with the same subject order as `defineJob`.
- `defineJob(name, { schema })` declares a job payload; `schedule()` and job handlers use it.
- `defineEvents('Campaign', { … })` returns `CampaignEvents`, `CampaignEvent.New(type, data)` and the parse helpers.
- `defineNotification(name, { schema, channels? })` declares a notification type (6.5).
- **Every envelope carries** its scope, a principal reference, `traceparent` and an idempotency id.
  - The scope is a tenant, an account (a user, for work started from `account` or `public` endpoints, such as the sign-up email), or system (work such as tenant deletion).
  - The worker binds `ctx.em` the way an endpoint of that scope would, and only tenant-scope work checks the tenant's status.
- **Publishing, scheduling and notifying take `ctx`** in their options. It supplies the tenant, the principal, the trace and the transaction, so the outbox and the jobs table are written in the same unit of work.

### 1.11 Translation keys (`apps/src/i18n/`)
- **Message keys** are derived (see the naming table). `messageKeys(resource)` lists every key a resource uses, so apps and tests can check their catalogs.
- **The framework ships English messages** for its own keys (errors, auth flows, validation). A missing key fails a test, and never fails silently at runtime.

### 1.12 Agent tools (`apps/src/tools/`)
- **`toTools(endpoints, options?)`** returns tool definitions `{ name, description, inputSchema }`. The input schema is JSON Schema from the endpoint's wire request schema (`io: 'input'`). Descriptions come from field `description`s and message keys.
- **Exposure is opt-in per endpoint:** `endpoints(C, { tool: true })` or `endpoint({ tool: true })`.
- **Invocation:**
  - In-process, `invokeTool(call, { principal })` runs the endpoint's full pipeline as an `AgentPrincipal`: tenant, access, validation and projection.
  - Out-of-process agents (Python, langgraph) call over HTTP with an agent token, under the same rules.
- **Tool calls are metered (6.7) and audited (6.8).** Metering goes to a no-op sink until 6.7 (see "Stand-ins"). This carries forward the `aiTool` intent from `validatable.ts`.

### 1.13 Search
Search is declared once, and is off until a list asks for it. The database side is 3.9.

It's declared as `list: { search: { fields: ['name', 'description'], mode? } }`.
- `List<P>` gains `q`, a search string capped at `DEFAULT_MAX_SEARCH_LENGTH` (200). It combines with `where`, and the tenant constraint always applies.
- `mode: 'text'` (the default, and for now the only mode) uses Postgres full-text search over the listed fields, ranked by relevance unless `orderBy` is given. Search by meaning is deferred.
- Only fields the caller can read can be searched, the same rule as for filters (1.6). Naming a server-only field is a definition-time error.

---

## Phase 1.5 — Thin UI spike

Build one form and the client against `Offering`, with a stub `fetch` and no Express yet. It exercises:
- the flat `Request` and the tenant header;
- the envelope and 422 mapping;
- i18n labels;
- `useCan`;
- the data layer (TanStack Query under our API).

---

## Phase 2 — Express adapter and API factory (`@epsilon-asi/apps/express`)

### 2.1 Runtime lifecycle (`@epsilon-asi/apps/runtime`)
- **Services:** `defineService({ name, start, stop })` declares a service, and `runApplication({ services, name?, env?, shutdownTimeoutMs? })` runs them in order and stops them in reverse. `name` defaults to the package name, `env` to `ApplicationEnv`, and `shutdownTimeoutMs` to `DEFAULT_SHUTDOWN_TIMEOUT_MS`.
- **Health:** `/health/live` and `/health/ready`. When a drain starts, readiness flips to failing first. Both bypass auth and rate limits, and both reveal nothing (M14).
- **Drain:** on SIGINT/SIGTERM, the HTTP server calls `server.close()` and `closeIdleConnections()`, then `closeAllConnections()` when the timeout hits. `agents/api.py`'s `AsyncWorkerManager` is only a model here: it never reads its `stop_event`, and `asyncio.wait([])` raises when no workers are running.
- **Env:** `ApplicationEnv` uses foundation's `@Env` from `/env`, with `LOG_LEVEL` defaulting to `info`. It also reads `PORT`, `TRUST_PROXY` (2.2) and `APP_ENV`. Stack traces are never sent, whatever the environment says.
- **`APP_ENV`** is `production`, `development` or `test`. Its default, `DEFAULT_APP_ENV`, is `production`, so an unset value never turns on a dev or test behaviour. Every dev-only and test-only check reads it, and nothing reads `NODE_ENV`.

### 2.2 HTTP middleware (the HTTP binding of foundation's `chain`)
- **The chain is extracted here** (0.3). command-line's middleware core moves into foundation, and the CLI and HTTP bindings are built on it together. command-line's tests pass unchanged.
- **`defineMiddleware({ name, use?, needs?, provides?, handle(ctx, next) })`:**
  - `needs` names request fields the middleware reads. The endpoint contract declares those fields; the middleware doesn't own them (C6). A group checks that `needs` ⊆ `RequestOf<E>`, at the type level and at definition time.
  - `provides` names the keys it adds, for the duplicate-key check.
- **`ctx` holds:** `logger` (a child bound to `traceId`, principal and tenant), `traceId`, `principal`, the tenant and `membership`, `signal`, `raw: { req, res }`, `defer`, and everything provided upstream.
- **System steps** are always on and never listed in `use`: `authenticate`, `tenant` and `access`. The endpoint's scope (1.3) decides which run: `public` skips all three, and `account` skips `tenant`.
- **Built-in middleware:**
  - **`rateLimit`** is on by default (`createApi({ rateLimit: false | options })`):
    - It's keyed on the principal, so each user and each API key has its own limit.
    - Public endpoints have no principal, so they're keyed on IP. That needs a correct client IP, which needs `trustProxy`. It comes from `TRUST_PROXY` in the env unless passed. It takes a hop count or a list of proxy CIDRs. `true` (trust every hop) is refused, because it lets a client forge its IP. In development and test (`APP_ENV`) it defaults to off. In production, an app with a public route and no value set fails at startup with an error that names `TRUST_PROXY`. Every app has public routes (health, `/openapi.json`), so the deploy sets one variable and the call site still passes only routes.
    - A limited request gets 429 with `Retry-After`, and responses carry `RateLimit` headers.
    - A memory store multiplies the limit by the number of replicas, so it's for dev and tests. Outside them, `createApi` refuses a memory store unless `singleReplica: true` is set. The Redis store (6.9) is the default once Redis is registered.
    - A second bucket limits each tenant as a whole, so many keys can't multiply one tenant's limit. Keys per tenant are capped (`DEFAULT_MAX_API_KEYS`).
    - Stricter defaults apply to auth endpoints.
  - **`idempotency`** runs on endpoints that declare the `Idempotent` header preset.
    - A record is keyed on tenant, principal, endpoint and key. It stores a fingerprint of the request, so the same key with a different body is a 422.
    - The first response is replayed for 24 hours. A duplicate that arrives while the first is still running gets 409 `Idempotency.IN_PROGRESS`, so nothing waits across replicas.
    - Records live in Postgres and commit in the same unit of work as the write, so a crash can't leave an effect without its record. It arrives with Phase 3, because its records live in Postgres.
    - Responses over a size cap aren't stored, and each principal has a quota.
  - `timing` and `rawBody` (for webhooks).
  - `requireAccess(...)`, `requireFeature(...)` and `requireBudget(...)` come from the access map, billing and metering.

### 2.3 Routes and handlers
- **`handler(Endpoint, { use?, handle })`** binds one handler, where `use` is route middleware and `handle` is the function. `request` is `RequestOf<E>`, `ctx` is typed from the group's and the route's `use`, and the return is checked. Spike S0 confirms the typing of this form. The trailing-function form is the verified fallback (T12).
- **`group({ use })`** returns `{ handler, routes }` bound to that group's middleware.
- **`routes({ handlers })`** takes a list of bound handlers and handler sets (such as `crudHandlers(C)`), so a resource's routes are one expression. A hand-written handler wins over a default one.
- **`webhook({ name, path, verify, handlers })`.** A webhook is public, and its verifier is what authenticates it. Prebuilt verifiers (`stripeVerifier`, `hmacVerifier({ header, secret, toleranceMs })`) check timestamp tolerance and every signature, compare in constant time, and dedup event ids in a ledger (Security 8). Webhooks arrive with Phase 3, because their ledger is a table.

### 2.4 Request pipeline (per route, compiled once at startup)
1. Match the route and enforce the body size limit.
2. `authenticate` from the `Authorization` header only → 401, unless the endpoint is public. If the session store can't be reached → 503.
3. `tenant` (for `tenant`-scope endpoints): from the header or the principal's bound tenant, then a membership check → 400 if the tenant is missing, 404 if it isn't the caller's.
4. **Access floor:** the minimum role across the endpoint's rules → 403.
5. Read the sections, decode them pollution-safely, and validate strictly → 422 with flat paths.
6. **Full access rules** (conditional, field-level, ownership) → 403. The parent must belong to the tenant → 404.
7. Run the route chain, then the handler.
8. Project through the `read` variant, encode, and send the envelope. The HTTP status always equals `body.code`.
9. Map errors in this order: zod → 422; `defineErrors` errors and `failure.*` results → their code; adapter mappers; anything else → 500 with `traceId` only. Database `detail` and stack traces are never sent.
10. Nothing runs after the response is sent. One terminal 404 handles unmatched routes only.

**Definition-time checks** (`ApiDefinitionError`):
- duplicate method and path;
- a path param with no request field;
- a non-public route on an app without an `authenticate` verifier (`createApi` refuses to start);
- a middleware `needs` field missing from the contract;
- a handler for a disabled operation;
- two handlers for one endpoint.

### 2.5 Browser and transport security defaults
- **CORS:** an allow-list from `CORS_ORIGINS`. The API never sends `Access-Control-Allow-Credentials`, because it uses no cookies.
- **No cookies.** The API never sets or reads one. Credentials travel only in the `Authorization` header, so CSRF defenses aren't needed. A test fails if any response carries `Set-Cookie`.
- **No session token or API key ever appears in a URL,** including for streams.
- **Emailed one-time tokens ride in the URL fragment,** which a browser never sends to a server. The UI removes it from the address bar and spends the token only when the user clicks, so a mail scanner that opens the link can't use it up.
- **Tokens in the browser.** A bearer token held by JavaScript can be read by a script injected into the page. That risk comes with bearer tokens, and the defenses are layered:
  - the access token lives 15 minutes and stays in memory;
  - the refresh token works once, and reuse revokes the session;
  - any session can be revoked at once, by the user or by staff;
  - `ui` ships a strict CSP and loads no third-party scripts.
- **Security headers on every response:**
  - `Strict-Transport-Security`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` on API responses
  - `Cache-Control: no-store` on authenticated responses
- **CSP for the UI** belongs to whatever hosts it. `ui` ships a recommended policy and avoids anything that needs `unsafe-inline`.
- **Limits:** `DEFAULT_BODY_LIMIT` (1 MB JSON); upload limits arrive when multipart lands. `trust proxy` must be configured explicitly.
- **Each item above has a named test.**

### 2.6 Streaming
- **`stream(schema)` endpoints use SSE.**
  - The handler returns `AsyncIterable<Chunk>`, and each chunk is validated and projected.
  - A failure before the first chunk uses the normal envelope; after that, the stream ends with a terminal `error` event.
  - `ctx.signal` aborts on client disconnect.
  - The token is checked when the stream starts. A stream may outlive its access token, up to `DEFAULT_STREAM_MAX_MS`. On every heartbeat it re-checks the session, the membership and the tenant's status, and ends when any of them fails.
  - The client reads SSE through `fetch`, because the browser's `EventSource` can't send the `Authorization` or tenant header.
  - LLM token streams are the first user.
- **Realtime updates are deferred** (see "Deferred features"). The UI refetches after its own writes and when the window regains focus.

### 2.7 App factory
- **`createApi({ routes, services?, use?, env?, logger?, rateLimit?, cors?, trustProxy?, singleReplica?, bodyLimit?, health?, errorMappers?, verifiers? })`** returns `{ app, listen(port?), close() }`.
  - `services` registers runtime services, such as the ORM (3.1) and Redis (6.9).
  - When the ORM service is registered, `orm` and `unitOfWork` wrap every route automatically, so no route lists them.
- **`runApi(options)`** runs `createApi` inside `runApplication`, listening on `env.PORT` (`DEFAULT_PORT = 3000`). The common case passes only routes.

### 2.8 Example app (`packages/apps/examples/crud-api/`)
- `common/app.ts` and `common/resources/Offering.ts`, as shown above.
- The API uses a stub `authenticate` verifier with a token map, plus stub memberships across two tenants and several roles.
- The routes return stub read models.
- The end-to-end tests drive the real app through the typed client (see "Verification"). There is no database yet. From Phase 3, they run against a local Postgres.

### 2.9 The public API
The API the UI calls is the API outside callers use. Nothing is built twice.
- **Callers authenticate with an API key** (6.1) in the same `Authorization: Bearer` header. A key is bound to one tenant, so it sends no tenant header.
- **A `tenant`-scope endpoint can be called by key,** under its access rules, unless it sets `principals`. Account endpoints, and the kit's endpoints that grant access (members, invitations, keys, ownership, billing), accept users only (1.3).
- **`GET /openapi.json`** is generated from the wire schemas (`io: 'input'`). It lists every endpoint a key can call, with its access rule, errors and headers. `docs: false` hides an endpoint.
- **Limits are per key,** with `RateLimit` headers and 429 (2.2).
- **Writes can be retried safely** through the `Idempotent` preset (2.2).
- **Errors are stable.** The namespaced `error` type is the contract, and messages may change.
- **Usage per key is metered** (6.7) and audited (6.8).
- **`ui` ships an API keys page** (with 6.1).
- **Versioning** is 2.10. Outbound webhooks are a follow-up.

### 2.10 API versioning
- **Changes are additive by default.** A release may add endpoints, optional request fields, response fields and enum values. Callers are told to ignore fields and enum values they don't know. This also protects a browser tab that is still running yesterday's UI.
- **A breaking change can't slip in.** `apps-cli api check` compares every endpoint's contract with the snapshot committed at the last release. The snapshot covers every endpoint, including ones hidden from the OpenAPI document and ones only the UI calls, because a stale browser tab depends on those too. CI fails on a removed endpoint or field, a new required request field, a changed type, a tightened rule or a changed default, unless the change is declared as a new version.
- **The version is declared once,** in `createResourceSystem({ apiVersion })`, and the client sends it as `X-Api-Version`. A version is a date (`2026-11-16`), and URLs never change. Until stage 2, every caller gets the current shape. That's safe, because `api check` keeps every change additive.
- **Stage 2, built with the first breaking change:**
  - API keys are pinned to a version. Keys made earlier are backfilled with the last version before the change.
  - Deprecation is declared on an endpoint or a field (`deprecated: { since, sunset, replacement? }`). It shows in the OpenAPI document, responses carry `Deprecation` and `Sunset` headers, and use is counted per API key.
  - An unsupported version gets 400 `Api.VERSION_UNSUPPORTED`, which names the oldest supported one.
  - `defineVersionChange({ version, description, changes })` in `common` declares the change as data: rename a field, remove a field, change a type with converters, or remove an endpoint.
  - The layer upgrades old requests and downgrades responses for callers pinned to an earlier version.
  - It derives each version's OpenAPI document.
  - Handlers only ever see the current shape.
  - Each old version has a support window (`DEFAULT_API_VERSION_SUPPORT_MONTHS`).

### 2.11 Test kit (`@epsilon-asi/apps/testing`)
- **`createTestApp({ routes, ...createApiOptions })`** starts the real app on port 0. In-memory stand-ins replace Redis, the session store and pub/sub. It returns `{ client, as, close }`.
- **`as({ user?, tenant?, role? })`** returns a typed client acting as that principal. It signs in through a test verifier that only `createTestApp` registers. `createApi` refuses that verifier outside tests, so there is no back door in production code.
- **A database from Phase 3 on:** each test file gets a fresh schema built from the entities, on SQLite by default, or on Postgres for anything that depends on Postgres.
- **`/testing` is for tests only.** It's a dev dependency, and `check:browser` never sees it.

---

## Phase 3 — MikroORM adapter (`@epsilon-asi/apps/mikro-orm`)

### 3.1 Entities from the same class
- **`defineEntity(C, options?)`** is server-only. It builds `new EntitySchema({ class: C, properties })` from the resolved model.
  - Table, column and index names are derived, so most resources pass no options.
  - `options` overrides them (`table`, `columns`, `indexes`, `relations`) and takes `hooks`.
  - Column types are derived as before (string → varchar/text, number → int/double, Date → timestamptz, enum → enum, array/object → jsonb, the `Id` field → primary key).
  - The `Tenant` field is indexed by default.
  - Hooks are passed here, in API-only code.
- **`EntityOf<C>`** maps the flavors to MikroORM's `Opt`/`Hidden` (unmarked fields are `Hidden`), so `ctx.em.create` is typed correctly in hand-written handlers (M6). The generic implementation uses one stated internal cast.
- **`defineOrm({ entities })` is a runtime service.**
  - Production is configured by `DATABASE_URL`, plus `DATABASE_USER`/`DATABASE_PASSWORD` when they aren't in the URI. Nothing provisions a database.
  - Outside tests, the driver must be Postgres.
  - Every request runs under a `statement_timeout` (`DEFAULT_STATEMENT_TIMEOUT_MS`), so one slow query can't hold the shared database.
  - An `orm` middleware provides a request-scoped `ctx.em`.
- **The tenant constraint is a global filter.** Every tenant-owned entity registers it, and the request's `ctx.em` has it bound to the current tenant. A query on such an entity with no tenant bound throws. So a hand-written `ctx.em.find` is scoped exactly like `ResourceService`.
  - `own()` rules compile into the same kind of constraint.
  - **`unscoped({ reason })`** is the one way around it. It can't be imported. It's a capability on `ctx` that only system jobs, `apps-cli` staff commands and kit `/server` code receive (such as the last-owner check in `DeleteAccount`). An app's own `tenant`-scope handler never has it. Every call is audited.
  - **In `account` scope,** `ctx.em` binds the signed-in user instead of a tenant. A tenant-owned entity that declares `owner` (`Membership`) is filtered to that user's rows across tenants. Any other tenant-owned entity throws.
  - **The tenant itself (`'self'`)** is filtered to the bound tenant's own row.
  - **`'account'` rows** are filtered to the bound user, and a query on them under a tenant binding throws.

### 3.2 Typed query translator
- `toMikroOrmFind(listQuery, { tenant, parent })` returns `{ where, options }`.
- Tenant and parent constraints are always merged in, and they win over client filters.
- Array and json operators map to MikroORM's.
- No regex is ever built from user input.

### 3.3 Free services and unit of work
- **`ResourceService(C)`** is a base-class factory with `get({ ctx, id })`, `getOrFail`, `list({ ctx, query })`, `create({ ctx, input })`, `update({ ctx, id, patch })`, `delete({ ctx, id })`, `ref(id)` and `repository`.
  - Every method takes the tenant, parent and principal from `ctx`, applies tenant scoping for every ownership kind, and respects access modes and `patch` behavior.
- **`unitOfWork` is a transaction** (`em.transactional`) with one flush. The outbox, change events and audit events are written in it and dispatched after commit. `/mikro-orm` ships one binding-neutral implementation, plus the HTTP middleware. The consumer and job bindings (Phase 5) wrap the same implementation in their own middleware, because each binding keeps its own middleware identity (0.3), and so `/mikro-orm` never imports them.
- **Audit fields:** when a resource declares `createdBy`/`updatedBy`, they're filled from the principal.
- **Error mappers:** `NotFoundError` → 404; `UniqueConstraintViolationException` → 409; not-null, foreign-key and check violations → 409/422. Postgres `detail` never reaches the response.

### 3.4 Default handlers
`crudHandlers(C)` returns handlers keyed by operation (`Create`, `Get`, `Update`, `Delete`, `List`), because a class type carries no endpoint names. At startup, they bind to the endpoints registered for `C`. A hand-written handler wins, endpoint by endpoint.

### 3.5 Relations
- **Declaration:** `@Prop.ref(() => SalesCampaign, { crud: 'createOnly' }) campaign!: CreateOnly<Ref<SalesCampaign>>`. A relation is marked like any field; unmarked, it would be hidden. The relation kind is derived from the field's shape and can be overridden in `defineEntity`.
- **Wire shape:** writes take `campaignId`; reads return the id. `expand` comes later.
- **A written reference is checked.** The layer loads the target through its own tenant scope before saving, so another tenant's id is a 422. A join used by a filter or a sort carries the target's tenant constraint too.
- **Filter paths** go through relations with automatic joins.
- **`parent`** binds to a relation foreign key, and the tenant id is copied from the parent on create (1.3).
- **Collections** (one-to-many, many-to-many) are read-only in CRUD and change through action endpoints.

### 3.6 Migrations
- **Production uses migrations.** `schema: 'update'` is for local dev only. Migrations never run on application boot in production; they run as a separate release step (a job) before new code serves traffic.
- **`apps-cli migrate create | up | down | check`:** `check` fails CI when the entities and the migrations differ.
- **Zero-downtime rules (expand/contract):**
  - A release only adds: nullable or defaulted columns, new tables, and indexes created `CONCURRENTLY`.
  - The code then writes both shapes.
  - A later release removes the old shape.
- **A migration linter** flags dropping or renaming a column or table, `NOT NULL` without a default, type changes, and non-concurrent index creation. Each needs an explicit acknowledgement in the migration file.
- **Every migration sets `lock_timeout` and `statement_timeout`.** Long backfills run as jobs, not migrations.
- **Migrations are Postgres-only.** SQLite tests build their schema from the entities.

### 3.7 Encrypted fields (`Secret<T>`, keys from `@epsilon-asi/apps/secrets`)
- **Encryption:** AES-256-GCM per value. The additional authenticated data binds the ciphertext to its table, column and row id, so a value can't be copied to another row.
- **Stored format:** `v1.<keyId>.<iv>.<ciphertext>.<tag>`.
- **Key ring:** `SECRETS_KEYS` (keyId → key) from the environment, read by `EnvKeyProvider`, the default. Cloud KMS subclasses, with envelope encryption, are deferred.
- **Rotation:**
  1. Add a new primary key; older keys become decrypt-only.
  2. The `RotateSecrets` job re-encrypts rows in batches. It arrives with jobs, in Phase 5.
  3. `apps-cli secrets check` reports rows still on old keys.
  4. Retire the old key.
- **Access:** a value is decrypted only when server code reads it. It is never in a response (`Internal`), never logged (redacted), and can't be filtered or sorted.
- **First users:** the TOTP secret (6.1) and third-party credentials.

### 3.8 Tests
- The adapter's unit and integration tests run on in-memory SQLite.
- These run on Postgres: `ilike`, arrays and json, migrations and the linter, and encryption round-trips.
- The example app switches to `crudHandlers(Offering)` and keeps one hand-written override.
- Search runs on Postgres.

### 3.9 Search in the database
- **Text search:** `defineEntity` adds a generated `tsvector` column over the search fields, with a GIN index, and the migration creates both. The text-search language is `DEFAULT_SEARCH_LANGUAGE` (`english`), and a resource can override it.

### 3.10 Factories and seeds (`@epsilon-asi/apps/testing`)
- **`defineFactory(Offering, { values? })`** builds valid rows. Each field's value comes from its schema: a string meets its `min`, an enum takes its first value, and a reference builds its target. Most factories pass nothing.
  - `factory.build({ values? })` returns an unsaved row.
  - `factory.create({ ctx, values? })` saves it through the resource's own service, so tenant scoping and access modes apply.
- **`defineSeed(name, { run })`** declares seed data, usually built from factories. `apps-cli seed` runs the seeds against the local database.
- **Seeding refuses** outside dev and tests. An `APP_ENV` other than `development` or `test` stops it, and so does a `DATABASE_URL` that isn't local.
- **`generate resource`** writes a factory next to the class.

---

## Phase 4 — React layer (`@epsilon-asi/ui`)

- **Data layer.** TanStack Query is the cache underneath. Our API sits on top, and callers never import it.
  - `CreateQueryProvider(ListOfferings)` returns entity-named exports through template literals: `{ OfferingsProvider, OfferingsContext, OfferingsConsumer, useOfferings }`.
  - Cache keys are the endpoint `Name`, the request, the tenant and the principal. The cache is cleared whenever the principal changes.
  - Mutations invalidate the resource's lists and gets, using endpoint metadata.
  - Queries refetch when the window regains focus. `invalidate(resource)` is the hook realtime updates will use when they land.
- **Forms.** `CreateFormContext(endpoint, { defaults?, extend?, refine?, onSubmit?, onSuccess?, onFailure? })` returns the maxleads names.
  - `extend`/`refine` add form-only fields such as `confirmPassword`, so there are no `UIRequest` classes.
  - Submit goes through RHF's `handleSubmit`, and a prop `onSubmit` wins over a static one.
  - 422 `issues` map onto fields.
  - Field access rules disable fields.
  - Labels come from i18n.
- **Fields.** `Field name` is typed by `FieldPath<RequestOf<E>>`, and the input kind, label and options come from the `ui` extension. `FormFields` renders an operation's writable fields in order.
- **Lists.** List state is synced to the URL, and the page resets when a filter changes. The DataTable is built from the list caps.
  - It adds a search box when search is declared.
- **`CreateResourceContext(GetOffering)`** returns entity-named exports through template literals: `{ OfferingProvider, OfferingContext, useOffering }`.
- **Session and tenant:**
  - `useSession()` returns the principal.
  - The session provider holds the tokens through the client (1.9), and signs the user out only when a refresh returns 401. On a 503 or a network failure it keeps the tokens and retries with backoff.
  - `TenantProvider` and `useTenant()` hold the active tenant; the client reads it for the header.
  - `useCan()` and `useEntitlement()`.
- **i18n.** An `I18nProvider` adapter ships with the framework's English messages.
- **Kit UI** ships with each kit in Phase 6, and the jobs admin page with Phase 5. Phase 4 builds only the layer they sit on.
  - auth pages: sign in, sign up, verify, reset, accept invitation, MFA;
  - sessions and API keys;
  - membership and invitation management;
  - the jobs admin page;
  - the usage summary.
- **Prerequisite.** Check React 19, MUI 7 and vitest in the ui package, and that `@hookform/resolvers` supports zod v4.

---

## Phase 5 — Messaging, jobs and workers

- **Topics (`/pubsub`).**
  - **The transport is a base class** (see "Cloud providers"). `PubSubTransport` owns validation, envelopes, the failure policy, idempotency, tenant restore, tracing and limit checks. A subclass implements `publish`, `subscribe`, `ack`, `nack` and `provision`. GCP (`GcpPubSubTransport`) ships first. The AWS design is in the appendix (A.13).
  - `publish(Topic, { ctx, message })` is typed and validated.
  - `consumer(Topic, { use?, handle, failure? })` runs on the chain with a failure policy. Validation failures and unknown errors behave as before. The defaults are `maxAttempts: 5`, then the dead-letter topic.
  - `idempotent` middleware keeps a message-id ledger in the same transaction.
  - The tenant context is restored from the envelope.
- **Provisioning.** `runConsumer({ consumers })` checks, or with an opt-in flag creates, each provider's subscriptions and dead-letter targets from the declarations, through the transport. A CI check fails any topic that has no consumer.
- **Jobs (`/jobs`) replace the maxleads queuer**, which was a delayed-job queue, not a set of loops (M10).
  - `schedule(Job, { ctx, payload, at?, delay?, key? })` writes to a Postgres jobs table.
  - Workers claim jobs with `FOR UPDATE SKIP LOCKED`, hold a lease with a heartbeat, retry with backoff, and finally mark a job dead.
  - `cron(Job, { schedule: '0 * * * *' })` dedups each slot.
  - Paid side effects run under an idempotency key.
- **`loop()`** is only for genuinely periodic work. It holds a lease, so one replica runs it.
- **State machine guards in workers.** `inState(CampaignLifecycle, { states: ['RUNNING'] })` stops work for paused or cancelled records. It ships for both the consumer and the job bindings.
- **Outbox.** A message is written to an outbox table in the unit of work and published after commit. A relay in the worker publishes anything left behind, so a crash between commit and publish loses nothing. Delivery is at-least-once. Jobs need no outbox: `schedule` writes to the jobs table in the same transaction.
- **Events.** `defineEvents` domains publish to one events topic.
- **Job visibility.** `Job` and `DeadLetter` are resources. A dead job stays in the jobs table. A dead message is copied from the provider's dead-letter target into the `DeadLetter` table by a built-in consumer, so it can be listed and replayed.
  - Endpoints: list and get, filterable by state (scheduled, running, succeeded, failed, dead), job name, tenant and time.
  - Actions: `RetryJob`, `CancelJob`, `ReplayDeadLetter`, `DiscardDeadLetter`.
  - Tenant admins see their own tenant's jobs through `tenant`-scope endpoints, when the app enables it. Staff see every tenant's jobs through `apps-cli jobs`.
  - `ui` ships a `JobsAdmin` page. Counts per state come from the job list endpoint; exporting them as metrics waits for the metrics follow-up.
- **App kinds:** `runConsumer`, `runWorker` (jobs) and `runDaemon` (loops), all built on `runApplication`.
- **Local dev** uses Google's Pub/Sub emulator, which `dev` starts. `MemoryPubSubTransport` can't carry a message from the API process to a worker process, so it's for tests only.
- **Tests:** unit tests use `MemoryPubSubTransport`. The transport conformance suite runs against the Pub/Sub emulator. Job locking and cron dedup are tested on Postgres, because SQLite can't test `SKIP LOCKED`.

---

## Phase 6 — SaaS kits

Each kit has three parts: a contract entry (resources, endpoints, message keys), which is browser-safe; a `/server` entry for Node; and UI in `ui`. An app adopts a kit in one line and extends its base classes (`class Organization extends TenantResource`). The generator writes only the subclass files.

### 6.1 Identity and accounts (`/identity`)
The flows are taken from maxleads and rebuilt to meet the "Security requirements".

| Flow | maxleads source | Endpoints |
|---|---|---|
| Sign-up and email verification | `CreateUser`, `VerifyNewUser` | `SignUp`, `VerifyEmail`, `ResendVerification` |
| Sessions | `Login`, `WhoAmI` | `SignIn`, `RefreshSession`, `SignOut`, `WhoAmI`, `ListSessions`, `RevokeSession` |
| Passwords | `GenerateForgotPasswordToken`, `ChangePasswordByForgotPasswordToken`, `UpdatePassword` | `ForgotPassword`, `ResetPassword`, `ChangePassword` |
| SSO | `InitiateGoogleSSOLogin`, `AuthenticateGoogleSSOLogin` | `StartSso`, `CompleteSso` (generic OIDC; Google first) |
| Invitations | `AddMemberToOrganization`, `VerifyInvitedUser` | `InviteMember`, `AcceptInvitation`, `RevokeInvitation`, `ListInvitations` |
| Profile and account | `UpdateUser`, `ArchiveUser` | `UpdateProfile`, `RequestEmailChange`, `ConfirmEmailChange`, `DeleteAccount` |
| Tenants and memberships | organization endpoints | `CreateTenant`, `ListMyTenants`, `ListMemberships`, `UpdateMembershipRole`, `RemoveMember`, `LeaveTenant`, `TransferOwnership` |
| API keys | — | `CreateApiKey`, `ListApiKeys`, `RevokeApiKey` |
| MFA | — | `EnrollTotp`, `ConfirmTotp`, `VerifyMfa`, `DisableTotp`, `RegenerateRecoveryCodes` |
| Agent tokens | `CreateBotAuthenticationToken` | `issueToken({ kind: 'agent', tenant, user, grant?, ttlMs? })` (server API). `kind` leaves room for bot tokens later. Service principals are in-process only and get no token. |

Rules:
- **Passwords:** argon2id, with a minimum length (`DEFAULT_PASSWORD_MIN_LENGTH`, 12) and no composition rules. SSO-only accounts have no password. Emails are normalized. `SignUp`, `ForgotPassword`, `ResendVerification`, `RequestEmailChange` and `InviteMember` give the same response whether or not the email exists. `SignIn` gives one generic error, and checks a dummy hash when there is no such account, so timing tells nothing.
- **User status** is `ACTIVE` or `DISABLED`. Disabling a user deletes their sessions and blocks sign-in and refresh. `apps-cli user reset-mfa` is the way back for a user who lost both device and codes. It's audited and tells the user.
- **Staff tools are `apps-cli` commands,** not API endpoints: `user disable | enable | revoke-sessions | reset-mfa`, `tenant delete` and `jobs`. They run against the production database and Redis as a `ServicePrincipal`, so who can run them is decided by who holds those credentials. Each needs a `--reason`, and each call is audited through `unscoped`. A staff console with platform roles is deferred.
- **An unverified account** can sign in, and can do nothing else until the email is verified, except ask for the verification email again.
- **One-time tokens** (verification, reset, invitation, email change):
  - 32 random bytes, stored as SHA-256 in Postgres, single-use, consumed inside a transaction. They stay in Postgres because an invitation has to survive a Redis restart.
  - Exported expiry defaults: verification 24 h, reset 1 h, invitation 7 days.
  - A reset or a password change revokes the user's other sessions.
- **Sessions are bearer tokens, with their state in Redis only.** Postgres holds no session data.
  - **Sign-in returns two opaque tokens:** an access token (`DEFAULT_ACCESS_TOKEN_TTL_MS`, 15 min) and a refresh token. Each is 32 random bytes behind a prefix that names its kind (`<app>_at_…`, `<app>_rt_…`), so the `authenticate` step picks the right verifier and secret scanners can spot a leak.
  - **A session is one Redis record per sign-in,** plus an index of each user's sessions. Tokens are stored as SHA-256, so a Redis dump yields nothing usable. The record holds the user, creation and last-use times, the times of the last identity proof and the last MFA check, the user agent, and `actor`, reserved for impersonation.
  - **Lifetimes:** an idle timeout and an absolute timeout, both Redis expiries, with exported defaults (`DEFAULT_SESSION_IDLE_MS`, `DEFAULT_SESSION_ABSOLUTE_MS`).
  - **`RefreshSession`** swaps the refresh token for a new pair. A refresh token works once. Using an old one revokes the whole session, because it means the token was copied. The previous token stays valid for a few seconds (`DEFAULT_REFRESH_GRACE_MS`) and returns the same pair, so two tabs or a network retry aren't mistaken for theft. For that window, the new pair is kept encrypted under a key derived from the old token, so the store still holds nothing usable on its own. Rotation is one atomic Redis script, so it's correct across replicas.
  - **Revocation is immediate.** `SignOut`, `RevokeSession`, a password change or reset, an MFA change, account deletion and staff action all delete the record.
  - **`ListSessions` and `RevokeSession`** read and write the store. `Session` is a typed record, not a database resource.
  - **The store is `SessionStore`,** backed by Redis (6.9), with an in-memory fake for tests. Outside tests, the identity kit refuses to start without `REDIS_URL`. If Redis can't be reached, requests get 503, not 401, so clients keep their tokens.
  - **Which endpoints check which token.** `SignIn`, `RefreshSession`, `VerifyMfa`, `StartSso`, `CompleteSso`, `SignUp`, `VerifyEmail`, `ForgotPassword` and `ResetPassword` are `public`, and each checks its own token. A refresh token (`_rt_`) is accepted only by `RefreshSession`. The `authenticate` step refuses it, so a refresh token in `localStorage` can't stand in for an access token.
  - **Expired versus unknown.** The session record keeps the current access token's hash and expiry. An expired access token on a live session answers `Auth.TOKEN_EXPIRED`, and the client refreshes. Anything else answers `Auth.UNAUTHENTICATED`. Agent tokens have no refresh token, so they always get `UNAUTHENTICATED`.
  - **MFA challenges, SSO state and agent tokens** are records in the same store, each with its own expiry.
  - **In the browser,** `ui` keeps the access token in memory and the refresh token in `localStorage` (1.9, 2.5).
- **MFA:** TOTP (RFC 6238) plus recovery codes.
  - The TOTP secret is a `Secret` field. Recovery codes are stored hashed and are single-use.
  - Enrollment takes effect only after `ConfirmTotp` proves a working code.
  - With MFA on, a correct password yields a short-lived challenge, not a session. `VerifyMfa` takes a code or a recovery code and creates the session.
  - A code can't be used twice in its time step, and attempts are rate-limited per account.
- **Step-up:** a sensitive action needs a fresh proof of identity: the password, an MFA code, or a fresh SSO sign-in for an account with no password.
  - The actions are `EnrollTotp`, `DisableTotp`, `RegenerateRecoveryCodes`, `ChangePassword`, `RequestEmailChange`, `DeleteAccount`, API key creation, `TransferOwnership` and tenant deletion.
  - Without it, a stolen access token could enroll its own MFA and lock the owner out.
- **Email change:** the new address is verified before the switch, and the old address is told.
- **`DeleteAccount`** is refused while the user is the last owner of a tenant.
- **No auth vendor and no auth framework.** The kit uses small single-purpose libraries behind its own interfaces (an argon2 binding and a certified OIDC client), so the resources, routes and client stay ours.
- **OIDC:** `state`, PKCE and `nonce`, held in the session store. `StartSso` also returns a one-time verifier that the UI keeps in `sessionStorage` and sends back with `CompleteSso`. That ties the flow to the browser that started it without a cookie. The provider redirects to a UI route, never to the API. The `code` arrives in that route's query, as the standard requires; it works once, and only with the PKCE verifier and the browser's verifier.
  - An SSO identity links to an existing account by email only when the provider reports `email_verified`, the provider is trusted to say so (`trustEmailVerified`, per provider), and that account's own email is verified.
  - An unverified account with the same email is reset first: its password, factors and sessions are removed. Otherwise someone could sign up with a victim's address and wait for them to arrive through SSO.
  - Later sign-ins match on the provider's issuer and subject, not on email.
  - With MFA on, `CompleteSso` yields the MFA challenge too.
- **Rate limits** per IP and per account on sign-in, reset, verification and MFA, with backoff. The backoff applies to an account and IP together and is never a hard lock, so nobody can lock a known address out.
- **API keys:** prefixed (`<app>_live_…`), shown once, and stored hashed in Postgres, because they must outlive a Redis restart.
  - A key is bound to one tenant and belongs to the tenant, not to the member who made it, so it survives that member leaving.
  - It carries a role no higher than its creator's, optionally narrowed to named permissions.
  - Creating one needs `ADMINISTRATOR` by default.
  - Last use is tracked, and revoking takes effect on the next request.
- **Invitations** are bound to an email, with a role no higher than the inviter's. The role is checked again against the inviter's current role when the invitation is accepted, and an invitation from a removed member is void. `AcceptInvitation` is an `account`-scope endpoint: it finds the invitation by its token, which must match the user's verified email.
- **Membership changes:** a member can't change or remove someone with a higher role, and can't grant a role above their own. A tenant always keeps an owner: any change that could remove the last one (leave, demote, remove, delete account) locks the tenant row first.
- **Roles are read from the membership on every request,** so removing or demoting a member takes effect at once, for their sessions and for agent tokens acting for them.
- **Offboarding:** `RemoveMember`, `LeaveTenant` and `DeleteAccount` revoke the member's agent tokens in that tenant, void their pending invitations, and tell the owners which API keys that member created, so they can be reviewed. Offboarding runs registered hooks, so a later kit adds its own cleanup.
- **Emails** go through 6.5.
- **Resources** (base classes the app extends): `User`, the tenant (`Organization`), `Membership`, `Invitation`, `ApiKey`, `VerificationToken`, `MfaFactor`, `RecoveryCode`. Sessions aren't on this list, because they live in Redis.

### 6.2 Tenant lifecycle (deletion)
- **`TenantLifecycle`** is a state machine on the tenant's `status`:
  - `ACTIVE → PENDING_DELETION`, by an owner (with step-up) or by `apps-cli tenant delete`, with a grace period (`DEFAULT_TENANT_DELETION_GRACE_DAYS = 30`) during which `cancelDeletion` undoes it;
  - `→ DELETED`, by a job.
- **During the grace period the tenant works normally,** and its owners are told when it will be deleted. `DELETED` answers 404.
- **Status is checked wherever a tenant context is restored:** HTTP, consumers, job workers, cron, agent tools and open streams. Today that check only refuses a deleted tenant. Suspension and locking will use the same check when they land. The deletion job runs as system work (1.10).
- **Deletion job:**
  - It walks every tenant-owned resource from the declarations, children before parents.
  - It destroys the tenant's encrypted secrets.
  - It writes a tombstone audit record.
  - Like offboarding, deletion runs registered hooks, so later kits add their part: 6.6 cancels the subscription.
  - Order matters. It marks the tenant deleted first. Then it cancels the tenant's scheduled jobs, subscription, API keys and tenant-bound tokens. Only then does it remove rows, so a late job can't recreate anything.
- **Ownership:** `TransferOwnership`; the last owner can't leave.

### 6.3 Admin impersonation (deferred)
Deferred. See "Deferred features"; the design is in the appendix (A.2).

### 6.4 Connected accounts (deferred)
Deferred. See "Deferred features"; the design is in the appendix (A.9).

### 6.5 Notifications and email (`/notifications`)
This comes from maxleads' `MailgunService` and notification preferences. In-app notifications are deferred.
- **`defineEmail(name, { schema, subject, body })`** uses message keys. Transports are Mailgun, SMTP, and a console transport that is the dev default.
- **Sending goes through jobs and the outbox,** with an idempotency key.
- **Preferences** are per user and per notification type. `notify(Type, { ctx, user, data })` respects them, where `Type` comes from `defineNotification` (1.10).

### 6.6 Billing and entitlements (`/billing`)
- **Plans:** `definePlans({ free: { features, limits }, pro: {…} })` lives in `common`.
- **Entitlements** resolve per tenant. They feed the `feature('x')` access rule, `requireFeature`, `useEntitlement`, and access to shared rows.
- **Stripe adapter:**
  - a customer per tenant;
  - checkout and portal sessions;
  - subscriptions synced from verified, deduped webhooks;
- **A failed payment** drops the tenant to the free plan's entitlements after a grace period (`DEFAULT_PAYMENT_GRACE_DAYS`). Suspending the tenant instead is deferred with suspension.
- **maxleads reference:** `OrganizationService.authorizeBillingAccount`.

### 6.7 Usage metering and LLM cost limits (`/metering`)
- **Meters:** `defineMeter('llm.tokens', { unit: 'token', dimensions: { model, feature } })`. `meter(LlmTokensMeter, { ctx, quantity, dimensions })` records the tenant, principal and actor from `ctx`. Usage is an append-only table with rollups per period.
- **Limits:** plan limits (6.6) are checked before the work starts.
  - `requireBudget(Meter, { estimate })` works as middleware or as a tool guard, and fails with 402 `Usage.LIMIT_REACHED`.
  - It reserves the estimate atomically and settles the difference when the work ends, so parallel requests can't all slip under a hard limit. Concurrent metered streams are capped per tenant.
  - Soft limits send an email; hard limits block.
  - Caps can be set per tenant and per user.
- **LLM costs:** `meter()` takes token counts from the caller and computes cost from `DEFAULT_MODEL_PRICES`, which can be overridden. The `langgraph` package supplies the callback adapter that reports a model's input and output tokens, streams included, so `apps` never imports `langgraph`.
- **UI:** a `UsageSummary` endpoint serves the UI. Sending usage to Stripe for usage-based pricing is deferred.

### 6.8 Audit log (`/audit`)
- **`AuditEvent`s are written in the unit of work.** Each records the principal, actor, tenant, resource, id, operation, the names of changed fields (never their values) and `traceId`.
- **Auth events are audited too:** sign-in, failed sign-in, role changes and API key use.
- **Reading:** tenant admins can read their tenant's events, and staff read across tenants through `apps-cli`.

### 6.9 Shared infrastructure: Redis (`/redis`)
Listed with the kits, but built with Phase 2, because rate limiting and local pub/sub need it first (see "Program order").
This generalizes maxleads' `RedisService`. That service had typed, namespaced keys `<app>.<namespace>.<group>.<key>` with `LOCKS`/`CACHE`/`DEFAULT` namespaces. It was never used in production, swallowed errors, cast values without validating them, and set no TTLs.
- **`defineCache(name, { schema, ttlMs? })`** offers `get`, `set`, `delete` and `getOrSet`.
  - Values are validated with zod when read.
  - Every key has a TTL (`DEFAULT_CACHE_TTL_MS`).
  - Keys are tenant-scoped by default (Security 15).
- **`defineLock(name, { leaseMs })`** offers `withLock(key, { run })`, with lease renewal and a fencing token.
- **The session and token store** (6.1) lives here: records with expiries, plus an index of each user's sessions.
- **It also provides** the rate-limit store and general locks. Once the Redis service is registered, rate limiting uses it by default.
- **It's a runtime service,** configured by `REDIS_URL`. Errors surface; a cache miss is the only documented fallback.
- **Eviction:** sessions, locks and rate limits must never be evicted, so their Redis runs with `noeviction`. A cache wants the opposite, so it can point at a second instance through `REDIS_CACHE_URL` (default: `REDIS_URL`). At startup the service reads the eviction policy where the server allows it, and fails on one that could evict a session.
- **Durability:** Redis should run with persistence (an append-only file) or a replica, and the service checks that at startup where the server allows it. If Redis still loses its data:
  - every user signs in again;
  - agent tokens must be issued again by the code that issued them;
  - rate-limit counters and half-finished MFA and SSO steps reset.

  API keys, one-time tokens and idempotency records are in Postgres and survive.
- **When Redis is full or down:** session checks answer 503 (Security 16). Rate limiting fails closed on auth endpoints and open elsewhere, with an error logged.
- **Tests:** an in-memory fake implements the same interface, and integration tests run against a Redis container.

### 6.10 Scaffolding (`@epsilon-asi/apps-cli`)
`dev`, `api check`, `migrate` and `secrets check` arrive earlier, with the phases that need them (see "Program order"). This section adds the rest.
- **`new app <name>`** creates a pnpm workspace with `common`, `api`, `ui` and `workers` packages, all wired to the framework. It includes:
  - the app system with tenancy and roles;
  - the identity kit;
  - env classes;
  - a compose file for local Postgres and Redis;
  - `dev`, `test` and `migrate` scripts;
  - a CI template.
- **`generate resource <Name>`** creates the class, the `endpoints()` line, the routes file, the form and list files, a migration, a factory, and tests, all named by the conventions.
- **`generate endpoint | job | topic | email | meter`.**
- **`api check`** guards the public API against breaking changes (2.10), and the staff commands (`user`, `tenant`, `jobs`) are 6.1's staff tools.
- **`dev`** starts local Postgres and Redis containers, plus Google's Pub/Sub emulator when the app uses topics (all local only), and points the GCP transport at it. Then it runs migrations, and starts api, ui and workers with reload.
- **Generators write only what derivation can't produce.** Their output passes the definition-time checks and the type tests.

---

## Program order

| Order | Work | Notes |
|---|---|---|
| 1 | Phase 0 (0.0–0.5, except 0.3) | 0.3, the middleware chain, runs with Phase 2 |
| 2 | Spikes S0, S1, S3, S4, S5, S6 | |
| 3 | Phase 1 | Includes 1.13 (search) |
| 4 | Phase 1.5 | |
| 5 | Phase 2 | Includes 0.3, the Redis layer (6.9), and the first `apps-cli` commands: `dev` (Postgres and Redis) and `api check`. The test kit's `createTestApp` (2.11) lands here. The rate-limit store stays single-process until Redis is registered |
| 6 | Phase 3 | Adds 3.9 and 3.10, idempotency and webhooks (2.2, 2.3), which need the database, and `apps-cli migrate`, `secrets check` and `seed` |
| 7 | Phase 4 | |
| 8 | Phase 5 | `dev` adds the Pub/Sub emulator |
| 9 | Phase 6 | In this order: 6.5 (email), 6.8 (audit endpoints), 6.1 (identity, with the staff commands), 6.2 (tenant deletion), 6.6 (billing), 6.7 (metering), then the rest of 6.10 (`new app`, `generate`). Later kits plug into earlier ones through hooks (offboarding, tenant deletion), so no kit waits on a later one |

**Stand-ins until a later phase lands.** A hook works from the phase that defines it, with a stand-in until its real source arrives:
- Metering goes to a no-op sink until 6.7.
- Audit events are written by the unit of work from Phase 3 (3.3), so `unscoped` is audited from its first day. 6.8 adds the endpoints that read them, and the auth events.
- Tenant status is always `ACTIVE` until 6.2.
- API keys come from the example app's stub verifier until 6.1.

---

## Deferred features

None of these is in the first release. Each can be added later without reworking the core, because the seam it needs is built now. Before building one, read its design in the appendix and re-check it against this plan, which may have moved on.

| Feature | Why it waits | Seam kept now | Design |
|---|---|---|---|
| Realtime updates (`GET /events`) | The most complex single feature: a live channel that repeats every read rule, re-checks access on every heartbeat, and fans out across replicas. Lists already refresh after the user's own writes. | The unit of work's after-commit change list (3.3), and `invalidate(resource)` in the UI data layer | A.1 |
| Admin impersonation | An option on every endpoint and two exceptions, and it can't be used without a staff console. | `actor?` on `UserPrincipal`, in the session record and in audit events; the `impersonation` option name is reserved | A.2 |
| Staff console and `platform` endpoints | Cross-tenant HTTP access, platform roles and two tenancy exceptions. Staff tools are `apps-cli` commands meanwhile (6.1). | The `platform` scope value and the `staff()` rule name are reserved | A.3 |
| Bulk operations | A second access-check path that touches rate limits, metering and audit. | `bulk` is a reserved path segment | A.4 |
| Search by meaning (pgvector) | pgvector, embedding jobs and metering, which pull later phases forward. Text search stays. | The `mode` option on search | A.5 |
| Soft delete | Another way around the ORM filter, touching references, search, exports and deletion. Archival works through state machines now. | `restore` and `softDelete` are reserved | A.6 |
| Optimistic concurrency | `If-Match`, 412 and 428 on every versioned write. MikroORM supports it natively, so it's cheap to add. | `versioned` is reserved | A.7 |
| Tenant suspension, locking and data export | An opt-in on endpoints, more failure codes, status checks in every runtime, and the `Storage` concern. | The one tenant-status check (6.2) and the `status` field; `suspended` is reserved | A.8 |
| Connected accounts | OAuth, refresh locks and revocation hooks that no first-release flow needs. | The `KeyProvider` base, and the offboarding and deletion hooks | A.9 |
| AWS messaging (SNS and SQS), and the Redis Streams transport for other providers' local dev | GCP covers the first apps, and each later provider is one subclass. | The `PubSubTransport` base class and its conformance suite | A.13 |
| Cloud key management (Cloud KMS, AWS KMS) | Extra cloud SDKs, when keys from the environment are enough to start. | The `KeyProvider` base class with `EnvKeyProvider` | A.10 |
| Bot principals | Resource-bound tokens that maxleads needed for meeting bots. | The principal union's `kind`, and `issueToken`'s `kind` | A.11 |
| In-app notifications | A user-owned resource delivered over realtime, which is deferred. | `defineNotification` (1.10) | A.12 |
| API version pinning, deprecation and old-version support | They do nothing until the first breaking change. | `apiVersion` and the `X-Api-Version` header | 2.10, stage 2 |
| Stripe usage export | Only usage-based pricing needs it. | Meters (6.7) and the Stripe adapter (6.6) | — |
| Ownership through a parent chain (`through`) | Replaced by copying the tenant id from the parent, which keeps the tenant filter to one column. Add it only for a row whose tenant can't be known when it's created. | None needed | — |

---

## Follow-ups and tabled items

| Item | Status |
|---|---|
| Error tracking (Sentry or similar) | Tabled; come back to it. |
| Data retention and PII deletion policies | Tabled (infrastructure). |
| CI security (dependency audit, secret scanning, static analysis) | Out of scope for this repo; belongs in each app's CI. |
| Database backups and restore | Infrastructure. |
| OpenTelemetry exporters and metrics | Follow-up. `traceId`/`traceparent` propagation is in scope now. |
| Outbound webhooks to customers | Follow-up. |
| Python models | Follow-up: JSON Schema → pydantic, or type-bridge after flavors are stripped (type-bridge emits invalid Python for flavored types today, T13). |
| File uploads | Follow-up; multipart is reserved in the wire format. Uploads bring the deferred `Storage` concern (A.8). |
| Relation `expand` | Follow-up. |
| Enterprise SSO (SAML) and SCIM provisioning | Tabled. |
| Nested tenants (an organization holding projects) | Deferred. |
| Passkeys (WebAuthn), and a tenant setting that requires MFA | Follow-up. |
| Mobile and other non-browser first-party clients | They use the same bearer tokens. A native `TokenStore` is a follow-up. |
| Azure and other cloud providers | Follow-up; each is one subclass per concern. |

---

## Critical files

- **Root:**
  - New: `pnpm-workspace.yaml`
  - Changed: root `package.json`, `.github/workflows/validate.yml`, `scripts/{release,bump_version}.sh`, and `docs/ARCHITECTURE_AND_PHILOSOPHY.md`, whose Processes section names `run_for_packages.sh`
  - Removed: `scripts/run_for_packages.sh` and the per-package lockfiles
- **foundation:**
  - New: `src/{naming,logging,chain}/`, and an `src/env/` entry for the subpath
  - Changed: `src/index.ts` (browser-safe root), `package.json` (ESM, exports, `sideEffects`), `tsconfig.json`, `decorators/types/{typeRegistry,types}.ts`
  - Removed: `decorators/{requests,validation}/`
- **command-line, apps, system, langgraph:** env imports move to `@epsilon-asi/foundation/env`.
- **command-line:** rebound onto foundation's chain and logging; its public API is unchanged.
- **langgraph:** gains the callback adapter that reports token counts to `meter()` (6.7).
- **apps:**
  - Package setup.
  - Core: `src/{model,tenancy,access,endpoints,state,query,wire,responses,client,messaging,i18n,tools}/`.
  - Testing: `src/testing/` (`./testing`, dev only).
  - Adapters: `src/{runtime,express,mikro-orm,secrets,redis,pubsub,jobs}/`, with a `gcp/` folder under `pubsub`.
  - Kits: `src/{identity,notifications,billing,metering,audit}/`.
  - `examples/crud-api/` and `docs/CONVENTIONS.md`.
- **ui:** `src/{forms,queries,fields,i18n,session,kits}/`.
- **apps-cli:** a new package.
- **Reused:**
  - `createTypeRegistry`, `defineTypeExtension`, `TypeShape`, `TypeAgreement`
  - `createEnvSystem`, `loadEnv`
  - `createDecoratorRegistry`
  - command-line's chain machinery (moved, not rewritten)
  - `scripts/{bump_version,release}.sh`
- **Yours:** the uncommitted `.github/workflows/validate.yml` change and the untracked `CLAUDE.md`. Phase 0.0 builds on top of the workflow change.
- **Planning docs:** this plan (`docs/plans/resource-framework.md`) and the review it answers (`docs/reviews/resource-framework-plan-review.md`).

---

## Verification

**Every package, every phase.**
- CI runs `typecheck` (including type tests), `test`, `build` and `check:browser` on TS 5.9 and TS 7.
- `check:browser` covers foundation's root, `apps`' root, every kit contract entry, and a fixture `common` package that imports every root export. It uses esbuild with `platform: 'browser'`, nothing external, and a metafile with no Node built-ins, express, `@mikro-orm`, `@google-cloud`, `@aws-sdk` or redis. Each entry also compiles with `tsconfig.browser.json` (`types: []`, DOM lib).
- **Consumer view:** a fixture package type-checks against the built `.d.ts`, not against `src`.
- **Regression:** command-line's full vitest suite and both examples pass unchanged.

**Contract drift.** In a fixture app, renaming a field must break compilation in each layer, with one `@ts-expect-error` per layer:
- the handler;
- the client `Call`;
- the form `Field`;
- the ORM query;
- the list caps;
- an access field rule.

The tool-schema snapshot must also change.

**Type tests prove:**
- Every flavor/option mismatch is a compile error, and flavors are null-safe.
- `CreateInput`/`UpdateInput`/`ReadModel` key sets are exact, and derived types carry no flavors.
- An unmarked field is in no request type and no response type.
- `endpoints()` returns the exact pattern-named keys.
- `RequestOf` contains parent and id params and never the tenant field.
- `ListQuery` allows only declared paths and operators, with correctly typed operands.
- A handler's `ctx` has exactly what its group and route `use` provide.
- A handler's return must match `ResponseDataOf`, and `void` is rejected when a response is declared.
- A middleware's `needs` must be in the contract.
- `Field name` accepts only request fields.
- Access rules accept only declared roles, permissions and entitlements.

**End-to-end** (`examples/crud-api`, vitest; against a local Postgres from Phase 3). The suite starts the real app on port 0 and drives it through the typed client:
- **Success:** Create → 201 with a `ReadModel`; Get, Update, Delete and List → 200.
- **Validation:**
  - An invalid body → 422 with flat paths.
  - An unknown field → 422.
  - `type` on update and `id` on create → 422.
- **PATCH:** sending one key leaves every other field, including defaulted ones, unchanged (C1).
- **Auth and tenancy:**
  - Missing credentials → 401, before any 422.
  - Missing tenant on a `tenant`-scope endpoint → 400. An `account`-scope endpoint works without one.
  - Another tenant's id → 404.
  - A role below the floor → 403.
  - A conditional rule → 403.
  - A field rule → 403.
- **Routing:** an unmatched path → 404, and there is no second response after a success.
- **Wire:** dates with offsets survive the round trip, and a bracket query with filters and a two-key sort decodes correctly.
- **Projection:** unmarked, `Internal`, `WriteOnly` and `Secret` values never appear, nested or not.
- **Definition-time errors:** a duplicate route, an unauthenticated non-public route, and a missing `needs` field each throw at startup.
- **Shutdown:** readiness flips first, and `close()` drains an in-flight request.
- **Search:** `q` finds rows by text, never crosses tenants, and can't name a hidden field.
- **Test kit:** `as()` works in tests, and `createApi` refuses the test verifier outside them. Seeding refuses a production database.
- **Factories:** every resource's default factory builds a valid row.
- **Idempotency:** a repeated key replays the first response, the same key with a different body is a 422, and a duplicate still in flight gets 409.
- **Versioning:** `api check` fails on a removed field and passes on an added one, including on an endpoint hidden from the OpenAPI document.

**Security** (named tests, one per item under "Security requirements"):
- Prototype-pollution keys are rejected, and a request field named like a context key (`membership`, `principal`) never reaches `ctx`.
- A cross-tenant id returns 404 for owned, shared and parent-scoped resources, and for the tenant itself. A user can't reach another user's `'account'` rows.
- A path can never name a tenant other than the one in the header.
- An app's `tenant`-scope handler has no `unscoped`, and every `unscoped` call is audited.
- An `account`-scope endpoint reads only the signed-in user's rows, across tenants.
- With `APP_ENV` unset, the app behaves as production: the test verifier, memory stores and seeding are refused.
- `TRUST_PROXY=true` is refused at startup, and a forged `X-Forwarded-For` doesn't change the rate-limit key.
- A refresh token is refused everywhere except `RefreshSession`.
- Outbound clients share no defaults: a header set on one never reaches another.
- A 401 comes before any 422.
- No server-only field, nested or not, appears in a response, message, log or audit record.
- Admin endpoints refuse unauthenticated calls, and `/health/live` and `/health/ready` return only a status.
- An unmarked field never appears in a response, and can't be filtered or sorted.
- Strict requests reject forbidden fields.
- A webhook replay, a bad signature and a timestamp outside the tolerance are all rejected, and every signature header is checked.
- Passwords are stored with argon2id, and password sign-in fails for an SSO-only account.
- Tokens and API keys are stored only as hashes, are single-use where that applies, and expire.
- An emailed one-time token travels in the URL fragment and is spent only on a click.
- A revoked or expired session fails on its very next request.
- A refresh token works once, and reuse revokes the session. Two refreshes inside the grace window get the same pair.
- No response sets a cookie, and no session token or API key appears in a URL or a log.
- With the session store down, an authenticated request gets 503: not 401, and not a pass.
- An API key can't call an account endpoint, can't act above its role, and can't create a key or invite a member.
- An agent token can't call an endpoint that isn't a tool.
- A hand-written `ctx.em` query can't read another tenant's row, and a body can't reference one.
- An entitled tenant can't write a shared row.
- A removed member's open stream ends within one heartbeat.
- A row created under a parent gets the parent's tenant id, never one from the request.
- A deleted tenant's jobs don't run, and the deletion job completes as system work.
- SSO can't take over an unverified account, and a stolen access token can't enroll MFA.
- Every staff command needs a reason and is audited.
- Postgres holds no session data.
- A TOTP code can't be replayed, and a recovery code works once.
- Responses don't reveal whether an email exists.
- CORS rejects unknown origins.
- Security headers are present.
- The body limit is enforced.
- Rate limits are keyed on the principal, and auth endpoints hit their stricter limit first.
- No `detail` or stack trace appears in an error.
- Secrets are encrypted at rest and still decrypt after rotation.
- Cache keys are tenant-scoped.

**ORM:**
- SQLite: the adapter's unit and integration tests.
- Postgres:
  - creating a row under a parent copies its tenant id;
  - `ilike`, arrays and json;
  - `migrate check` and the migration linter;
  - encryption;
  - the `ResourceService` isolation matrix from S4.

**React** (vitest and Testing Library):
- Client validation errors show.
- A mocked 422 maps onto fields.
- Submit sends the split request and the tenant header.
- The client refreshes once across tabs, and retries after an expired-token 401.
- The query provider encodes the bracket query.
- Mutations invalidate cached queries, and queries refetch when the window regains focus.
- `useCan` agrees with the server for the S4 cases.
- A missing i18n key fails.

**Messaging and jobs:**
- Every transport passes the same conformance suite (in-memory and GCP).
- `EnvKeyProvider` passes the `KeyProvider` conformance suite.
- Publish validates.
- The failure policy routes ack and nack.
- Messages are dead-lettered after `maxAttempts`.
- The idempotency ledger drops duplicates.
- A message in the outbox is still published after a crash between commit and publish.
- A job is claimed once under concurrency (Postgres).
- Cron dedups.
- Job admin actions work.
- Shutdown drains.

**Kits:**
- Every identity flow works end to end.
- Deletion removes every tenant-owned row and runs every registered deletion hook.
- Offboarding runs every registered hook.
- Metering blocks at a hard limit.
- Metering records a model's tokens through the `langgraph` adapter, and `apps` doesn't import `langgraph`.

---

## Appendix: deferred designs

These designs were written for this plan and then deferred on 2026-11-17. They are kept as they were. Some refer to sections that have since changed, so re-check each against the plan before building it.

### A.1 Realtime updates (was in 2.6)

- **Realtime: `GET /events`** is an SSE channel per principal and tenant.
  - After commit, the unit of work emits change events `{ resource, operation, id }`. They carry ids only, never field values, so projection and access rules can't be bypassed.
  - The UI data layer refetches the affected queries.
  - Events are filtered by tenant and by the principal's read access. Inside the server, an event also carries the tenant, owner and parent ids the filter needs. The client still receives ids only. A `Last-Event-ID` replay goes through the same filter.
  - In-app notifications reuse the channel.
  - Heartbeats are sent, and `Last-Event-ID` resumes a dropped stream.
  - The channel closes when its access token expires, and the client reconnects with a fresh one. On every heartbeat it also re-checks the session, the membership and the tenant's status, so a removed member loses it within one interval, on any replica.
  - Realtime is best-effort. When a reconnect can't resume, the UI refetches.
  - Fan-out across replicas goes through the Redis bus (6.9). The default is an in-process bus for a single replica.

### A.2 Admin impersonation (was 6.3)

- **`StartImpersonation({ userId, tenantId, reason })`** is a `platform`-scope endpoint. It requires `staff('SUPPORT')` and a reason. The target can't be staff, and the token works in that one tenant only.
- **It issues an access token with no refresh token** (`DEFAULT_IMPERSONATION_TTL_MS`, 30 min), so the session can't be extended. It is tied to the staff member's own session, and ends when that session ends or the staff role is removed. The principal is the target user, with `actor` set to the staff member.
- **Endpoints can opt out with `impersonation: false`.** The default is false for every endpoint that creates lasting access or can't be undone: passwords, email change, MFA, sessions, API keys, members, invitations, ownership, connections, billing changes, account and tenant deletion, and `StartImpersonation`.
- **Impersonation never reaches `account` scope**, except `WhoAmI` and `StopImpersonation`, because account scope spans every tenant. That keeps the token inside its one tenant; without it, `CreateTenant` would make the target the owner of a new tenant.
- **Every request is audited** with both the actor and the subject. Notifying the user or the tenant's owners is configurable.
- **UI:** the banner comes from `useSession().actor`, and `StopImpersonation` ends the session. It's an `account`-scope endpoint, and impersonation tokens may call it.

### A.3 Staff console and `platform` endpoints (was in 1.3, 6.1 and 6.2)

- **Scope:** `platform` has no tenant. Staff reach it through a `staff()` rule, for impersonation and for job and audit views across tenants.
- **Staff on a `tenant`-scope endpoint:** when the endpoint's rule includes `staff()`, a staff principal with that platform role passes the membership check. The tenant still comes from the header, the call needs a recent MFA check like any staff call, and it's audited. Writes to shared rows and staff transitions such as suspending a tenant work this way.
- **Platform roles** arrive with this kit, because its staff tools are the first `platform` endpoints. They're granted only by a platform `ADMIN`, or by `apps-cli staff grant` for the first one, and every grant is audited. A staff account must have MFA enrolled, and every `platform` call needs a recent MFA check (`DEFAULT_STAFF_MFA_MAX_AGE_MS`).
- **Staff user tools:** `DisableUser`, `EnableUser`, `RevokeUserSessions` and `ResetUserMfa`, all in `platform` scope.
- Access floor: a `staff()` rule adds a platform floor. Under `any(...)`, the check passes when either the tenant floor or the platform floor is met.
- Staff transitions (suspend, lock) go through the staff rule on `tenant`-scope endpoints, and staff-rule calls skip the suspended and locked checks.

### A.4 Bulk operations (was in 1.13 and Phase 4)

**Bulk operations** (`endpoints(C, { bulk: ['Create', 'Update', 'Delete'] })`):
- They're derived at `POST /<plural>/bulk/create`, `/bulk/update` and `/bulk/delete`. `bulk` is reserved, and literal paths are registered before parametric ones.
- Requests: `BulkCreate` takes `{ items: CreateInput[] }`. `BulkUpdate` takes `{ items }`, each with the id, the changes and (when versioned) the version. `BulkDelete` takes `{ items }`, each with the id and the version if needed.
- `items` is capped at `DEFAULT_MAX_BULK_ITEMS` (100).
- **All or nothing.** Every item is validated and checked against the access rules, including field rules and `own()`, before anything is written. The writes then run in one transaction. A failure is a 422 or 403 whose issue paths name the item (`items.3.name`), and nothing is written.
- Rate limits and metering count items, not requests. Audit records and change events are per item.
- The `Idempotent` preset is on by default.
- Responses: `{ <camelPlural>: ReadModel[] }` for create and update, and nothing for delete.

  - It adds row selection with bulk actions when bulk endpoints exist.

### A.5 Search by meaning (was in 1.13 and 3.9)

- `mode: 'vector'` ranks by meaning with pgvector. The app supplies the embedding function on the server (3.9), and its model calls are metered (6.7).
- **Vector search:** `defineEntity(C, { embed })` takes `embed: (row) => Promise<number[]>`. It stores a pgvector column, filled by a job after each write through the outbox, so writes never wait on a model. At search time `q` is embedded once per request, under `requireBudget` (6.7).

### A.6 Soft delete (was in 1.13, 3.9 and Phase 4)

**Soft delete** (`@Resource({ softDelete: true })`):
- The layer adds a server-set `deletedAt` field, which is server-only.
- `Delete<E>` sets `deletedAt` instead of removing the row. Gets, lists, references, search, realtime events and exports skip soft-deleted rows.
- `Restore<E>` (`POST /<plural>/:<e>Id/restore`) is derived and uses the `write` rule. `restore` is a reserved verb, so no transition can take it.
- `List<P>` accepts `deleted: 'only'` from callers who pass the `write` rule, so the UI can show a trash view.
- A `PurgeDeleted` job hard-deletes rows older than `DEFAULT_SOFT_DELETE_RETENTION_DAYS` (30). Tenant deletion and account deletion always hard-delete.
- Archival is a state, not a deletion. Model it with a state machine (1.5), as `OfferingLifecycle.archive` does.

  - It adds a trash view with restore for a soft-deleted resource.
- **Soft delete** is a global filter, like the tenant constraint (3.1), so a hand-written `ctx.em.find` skips deleted rows too. `unscoped` doesn't lift it. Only `withDeleted()` does: for the trash view, the purge job, and the tenant and account deletion jobs, which must remove soft-deleted rows too.
- **Unique indexes** on a soft-deleted resource are partial (`WHERE deleted_at IS NULL`). `defineEntity` derives them, so a name can be reused after a delete.

### A.7 Optimistic concurrency (was in 1.13, 3.9 and Phase 4)

**Optimistic concurrency** (`@Resource({ versioned: true })`):
- The layer adds a `version` field: an integer, readable, set by the server, and incremented on every write.
- `Get<E>` and every write response send it as an `ETag`.
- `Update<E>`, `Delete<E>`, `Restore<E>`, transitions and bulk updates need it back as `If-Match`. In the flat request it's a `version` field placed in that header, so a form sends the version it loaded with no extra code.
- A stale version is 412 `Conflict.STALE`. A missing one is 428 `Conflict.VERSION_REQUIRED`.
- The check and the increment are one statement (3.9), so two writers can't both pass.

- **Versioned forms** send the version they loaded. A 412 shows a "changed by someone else" message (`errors.Conflict.STALE`) and offers to reload.
- **`versioned`** maps to MikroORM's `version` property, which checks and increments in one `UPDATE … WHERE version = ?`. Its optimistic-lock error maps to 412.
- Default failures: 412 and 428, on writes to a versioned resource.

### A.8 Tenant suspension, locking, export and file storage (was in 6.2, "Layers" and "Cloud providers")

- **`TenantLifecycle`** is a state machine on the tenant's `status`:
  - `ACTIVE` ⇄ `SUSPENDED`, for billing failure or by staff;
  - any state to `LOCKED` and back, by staff, for abuse;
  - `ACTIVE | SUSPENDED → PENDING_DELETION`, by an owner or staff, with a grace period (`DEFAULT_TENANT_DELETION_GRACE_DAYS = 30`) during which it can be cancelled;
  - `→ DELETED`, by a job.
- **Suspended:** reads still work. Writes fail with `Tenant.PAYMENT_REQUIRED` (402) for a billing suspension, or `Tenant.SUSPENDED` (403) otherwise, enforced by the access layer, so there's no handler code.
  - An endpoint that must work while suspended opts in with `suspended: true`. The billing checkout and portal, the `cancelDeletion` transition (through `transitions()`'s per-verb options), the data export and tenant deletion do.
  - Calls that pass the staff rule (1.3) skip the suspended and locked checks, so staff can `unsuspend` and `unlock`. Both are transitions on `TenantLifecycle`.
  - `PENDING_DELETION` behaves like suspended. `DELETED` answers 404.
  - `LOCKED` blocks reads, API keys and streams too, with `Tenant.LOCKED` (403).
  - Staff transitions (suspend, lock) go through the staff rule on `tenant`-scope endpoints (1.3).
- **Status is checked wherever a tenant context is restored,** not only on HTTP: consumers, job workers, cron, agent tools and open streams. A suspended tenant's jobs are held, not run. The deletion and export jobs run as system work (1.10), so a suspended or pending-deletion tenant can still be exported and deleted.
- **Export:** the `ExportTenantData` job writes every tenant-owned resource's read model (skipping soft-deleted rows) as JSON Lines to storage, and emails the owner a link to a page in the UI. There, an `OWNER`-only endpoint with step-up hands back a signed URL that lasts about a minute, and the download is audited. Stored files are keyed under the tenant's id. This needs the `Storage` base class (`put`, signed `get`, `delete`) and its subclasses, which come in with this kit (see "Cloud providers").
- **Cloud providers:** `Storage` has the cloud subclasses `GcpStorage` (Cloud Storage) and `AwsStorage` (S3), and `DiskStorage` locally.
- **Layer:** `@epsilon-asi/apps/storage`, with providers `/storage/gcp` and `/storage/aws` (`@google-cloud/storage` and the AWS S3 SDK as optional peers). It owns the `Storage` base class (`put`, signed `get`, `delete`) and its local-disk subclass.

### A.9 Connected accounts (was 6.4)

- **`defineConnection('google', { scopes })`** declares a connection.
- **Endpoints:** `StartConnection`, `CompleteConnection` (OAuth with `state` and PKCE), `ListConnections`, `Disconnect`.
- **Server API:** `getAccessToken(connection, { ctx })` returns a valid token. It refreshes under a Redis lock, so concurrent callers refresh once.
- **Connection rows** are tenant-owned, with an owner user, and their tokens are `Secret` fields.
- **Storage and refresh are ours:** encrypted fields plus refresh locks. They sit behind a provider interface, so a vendor can be added later without touching call sites.
- **Connections are revoked** on disconnect, member removal, account deletion and tenant deletion.

### A.10 Cloud key management (was in 3.7 and "Cloud providers")

- **Cloud providers:** `KeyProvider` gets the subclasses `GcpKeyProvider` (Cloud KMS) and `AwsKeyProvider` (AWS KMS), in `/secrets/gcp` and `/secrets/aws`, with `@google-cloud/kms` and `@aws-sdk/client-kms` as optional peers. `EnvKeyProvider` stays the default.
- **Key ring:** `SECRETS_KEYS` (keyId → key) from the environment, read by `EnvKeyProvider`, the default. `GcpKeyProvider` and `AwsKeyProvider` use envelope encryption, with data keys wrapped by the cloud's KMS (see "Cloud providers").

### A.11 Bot principals (was in 1.3)

- `BotPrincipal`, scoped to a tenant and optionally a resource (a meeting);
- **Access:** a bot's tenant comes from its token, and the rules see no role. A bot reaches only endpoints that name `bot`, and only its bound resource.
- Bots are always opt-in.

### A.12 In-app notifications (was in 6.5)

- **In-app notifications:** a `Notification` resource, tenant-owned and user-owned, with endpoints to list unread, mark one read and mark all read. Notifications are delivered over realtime.

### A.13 AWS messaging and the Redis dev transport (was in Phase 5, "Layers" and "Cloud providers")

- **Layer:** provider subpaths `/pubsub/aws` (with `@aws-sdk/client-sns` and `@aws-sdk/client-sqs` as optional peers) and `/pubsub/redis` for local dev.
- **`AwsPubSubTransport`** uses SNS topics and SQS queues. Its concepts map onto GCP's like this:

    | Concept | `GcpPubSubTransport` | `AwsPubSubTransport` |
    |---|---|---|
    | Topic | Pub/Sub topic | SNS topic |
    | Subscription | Pub/Sub subscription | an SQS queue subscribed to the topic |
    | Dead letter | a dead-letter topic with `maxDeliveryAttempts` | a redrive policy to a dead-letter queue with `maxReceiveCount` |
    | Ack / nack | ack / nack | delete the message / reset its visibility timeout |
    | Retry backoff | the subscription's retry policy | a visibility timeout per attempt |
    | Ordering (opt-in) | ordering key | FIFO message group |

- **Local dev:** an app on any provider other than GCP uses `RedisPubSubTransport` (Redis Streams, from `/pubsub/redis`), on the Redis that `dev` already runs. It passes the same conformance suite, and refuses to start outside dev and tests.
- **Tests:** the conformance suite also runs against an SNS/SQS emulator and the Redis transport, and the Redis transport refuses to start outside dev and tests.
