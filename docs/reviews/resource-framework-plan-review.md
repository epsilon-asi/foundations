# Resource framework: plan review, next steps and open questions

- **Subject:** the plan now at [`docs/plans/resource-framework.md`](../plans/resource-framework.md) ("the resource framework: `@epsilon-asi/apps` and friends"). It was `~/.claude/plans/happy-stargazing-thunder.md` when this review was written.
- **Date:** 2026-11-15. Resolution added 2026-11-17.
- **Status:** **resolved.** Every question in §3 is answered, and every critical and major finding is addressed in the plan. §0 says where. The plan's "Decisions already made" table is the source of truth. Where this review proposed a design that the plan later decided differently, the plan wins.
- **First-release cuts (2026-11-17):** several features were then deferred, each with a seam kept. The plan lists them under "Deferred features" and keeps their designs in its appendix. §0 marks them below.

**Contents**
0. Resolution
1. TL;DR
2. Next steps
3. Open questions
4. Review: critical findings
5. Review: major findings
6. Review: minor findings
7. maxleads coverage
8. Missing capabilities for the SaaS-builder goal
9. Verified and refuted claims (scratch evidence)
10. Appendix: maxleads production security issues

**Conventions**
- `fnd/` is this repo (`/Users/chris/EpsilonASIWorkspace/foundations`).
- `ml/` is maxleads (`/Users/chris/EpsilonWorkspace/maxleads/maxleads`).
- T1–T13 are the scratch typechecks and runs in §9.
- maxleads evidence comes from four read-only deep reads, of the API, `common`, the UI and the workers. The most severe items were re-checked by hand; those are marked ✔.
- Finding classes:
  - (a) the plan is wrong
  - (b) the plan is missing something
  - (c) the plan is right but underspecified
  - (d) taste

---

## 0. Resolution (2026-11-17)

The answers to §3 are in that table's "Answer" column. Each step in §2 has a status line. Section numbers below refer to the plan.

### Where each finding is addressed

| Finding | Plan section |
|---|---|
| C1 · PATCH resets defaults | Decisions: PATCH semantics; 1.1 runtime model (`update` unwraps defaults); spike S1 |
| C2 · Nested projection leaks | 1.1 schema variants and server-only fields; 1.4 response projection; spike S1 |
| C3 · Tenant isolation is opt-in | Decisions: Tenancy; 1.3; 3.1 (the tenant constraint is a global filter); 3.5 (written references are checked); Security 1; spike S4 |
| C4 · foundation isn't browser-safe | Decisions: Packaging; 0.1 |
| C5 · `routes()` can't type per-route `use` | 2.3: `handler(Endpoint, { use?, handle })`, group-bound; spike S0 |
| C6 · Middleware owns request fields | 2.2: `needs` names contract fields |
| C7 · No principal or permission model | Decisions: Principals, Authorization; 1.3 principals and access maps |
| M1 · Phase 0 can't meet its acceptance | 0.0 (pnpm workspaces, ESM, TS 7) |
| M2 · Type tests don't run in CI | 0.0; Verification |
| M3 · A `void` return lies | 1.4 Handler returns |
| M4 · Default detection | 1.1 strict `Prop` (structural detection) |
| M5 · Flavors drop `null` and leak | 1.1 access flavors |
| M6 · MikroORM and flavors | 3.1 `EntityOf<C>`; spike S3 |
| M7 · Walker contract | 1.7 |
| M8 · Chain extraction | 0.3, which runs with Phase 2 |
| M9 · CLI-shaped logger | 0.2 |
| M10 · Queuer misread; failure policy | Phase 5 |
| M11 · State machines as editable fields | 1.5 |
| M12 · React layer | Phase 4 |
| M13 · Security defaults | Security requirements (17 rules, with their tests under "Verification"); 2.4; 2.5 |
| M14 · Health and shutdown | 2.1; spike S5 |

**Minor findings (§6):** all are in the plan. Two differ from what this review proposed:
- `crudHandlers` is keyed by operation (`Create`, `Get`, …), not by endpoint kind, because all five CRUD endpoints share one kind.
- SQLite is allowed for unit and integration tests, by the owner's decision. Anything that depends on Postgres behaviour, and every end-to-end test, runs on Postgres.

### Where this review's proposals were superseded

| This review proposed | The plan decided |
|---|---|
| npm workspaces (Step 3) | pnpm workspaces |
| `scope: [...]` chains and `definePermissions` (§2, Step 2) | parent scopes, ownership kinds and access maps (1.3) |
| `handler(Endpoint, { use }, fn)` (C5) | `handler(Endpoint, { use?, handle })`, one options object |
| an `orm` extension on the shared class (Q9) | server-only `defineEntity` (3.1) |
| sessions left open | bearer tokens, session state in Redis only, no cookies (6.1) |
| GCP as the likely target (Q6) | provider base classes; messaging ships GCP first, and AWS is deferred |

### Capabilities from §8

| Capability | Status |
|---|---|
| AuthN, AuthZ, orgs, memberships, invitations, multi-tenancy | In the plan: 1.3, 6.1, 6.2 (impersonation is deferred) |
| Billing, entitlements, per-plan limits | In the plan: 6.6, 6.7 |
| Notifications and email | In the plan: 6.5 |
| Jobs, scheduling, audit, migrations, secrets | In the plan: Phase 5, 6.8, 3.6, 3.7 |
| i18n, streaming, AI tools, OpenAPI, API versioning | In the plan: 1.11, 2.6, 1.12, 2.9, 2.10 (per-key pinning and deprecation wait for the first breaking change) |
| Files and uploads, outbound webhooks, Python interop, tracing exporters, metrics | Follow-ups in the plan |
| Soft delete and archival | Soft delete is **deferred** (appendix A.6). Archival is in the plan as a state machine (1.5). |
| Search (full-text and pgvector) | Full-text is in the plan (1.13, 3.9). Search by meaning is **deferred** (A.5). |
| Seeding and test kits (`defineSeed`, `createTestApp`, factories) | In the plan: 2.11, 3.10 |
| Bulk operations | **Deferred** (A.4) |
| Optimistic concurrency | **Deferred** (A.7) |
| Admin and back-office UI | Staff tools are `apps-cli` commands (6.1). A staff console is **deferred** (A.3). |

### maxleads coverage (§7) since this review
- Agent auth, agent tools and billing gates are in the plan (1.3, 6.1, 1.12, 6.6). Bot principals are deferred (A.11).
- Uploads remain a follow-up, with multipart reserved in the wire format.
- maxleads' seed factories are covered by 3.10. Its billing redirect gate in the UI is not in the plan.

---

## 1. TL;DR

The plan puts the weight in the right place for the contract half of the problem. It keeps one class per entity in `common`, endpoints with fixed member names, the flat `Request`, and adapters behind subpaths. It keeps maxleads' deliberately inconvenient patterns, and it keeps them for the right reasons. The type machinery it bets on is feasible, and each piece was verified:
- flavors and the strict `@Prop`;
- template-literal endpoint keys and path params;
- dot-path list caps turned into nested `Where` types.

Eight resources of 60 fields with cyclic dot paths check in 0.33 s on TS 5.9 and 0.07 s on TS 7.

As the first program of an all-in-one SaaS builder, it is **not ready yet**. Four groups of problems:

1. **Two derivation rules would corrupt data and leak secrets.** A PATCH resets every defaulted field. Response projection doesn't reach nested types. Both are verified (C1, C2).
2. **The base layer fails the plan's own guarantees.** foundation's root entry pulls `node:fs` into the browser, and TS 7 refuses foundation's tsconfig. Phase 0 can't pass its acceptance as written (C4, M1).
3. **The plan's server call site doesn't type-check as written.** Per-route `use` doesn't reach `ctx`. A group-bound shape does work, verified on TS 5.9 and TS 7 (C5).
4. **Tenancy and authorization happen by accident.** A scope param filters by whichever org the caller names. Roles are server-only middleware objects the UI can't reuse. There is no principal model (user, bot, agent, API key) (C3, C6, C7). That is maxleads' weakest area, and its production code has live security holes (§10).

**The fix:**
- expand Phase 0;
- run six short spikes;
- move identity, tenancy and permissions into the Phase 1 contract;
- adopt the group-bound handler shape;
- fix the derivation rules;
- treat the queuer as a job queue.

With those changes this is the right plan.

---

## 2. Next steps

The steps are in order. Each has a deliverable and a way to tell it's done. Step 0 doesn't depend on the plan and can start today.

### Step 0: triage the maxleads production security issues (independent of this plan)
- **Status:** out of scope for this repo. maxleads isn't being rebuilt (Q15), so these fixes belong with maxleads. The issues in §10 still exist there.

Details are in §10.
- [ ] **Confirm locally the items found only by reading:**
  - the open `/v3` proxy;
  - `NylasProxy` path traversal;
  - cross-org message actions;
  - the Recall token reaching Google.
- [ ] **Fix in this order:**
  1. Google SSO login: reject password login for `UserLoginType.GOOGLE`, and rotate those passwords.
  2. Query prototype pollution: reject `__proto__`/`constructor`/`prototype` keys in the unflatten, and stop trusting a pre-set `context.membership`.
  3. Lock down the Nylas proxies.
  4. Scope every message, thread and meeting action by org.
  5. Take the Recall token off axios' global defaults.
  6. Strip Postgres `detail` from responses.
- **Done when:** each item has a failing test that now passes, and the fixes are deployed.

### Step 1: answer the blocking questions in §3
- **Status: done.** Every question is answered; see §3.
- **Blocking:** Q1, Q2, Q3, Q5, Q7 and Q14. Each one changes a design in Phase 0 or Phase 1.
- **The rest:** can wait until the phase that needs them.
- **Done when:** the answers are written into the plan's "Decisions already made" table.

### Step 2: revise the plan document
- **Status: done.** The revised plan is `docs/plans/resource-framework.md`. Some rows below were superseded by later decisions; §0 lists them.

Edit `happy-stargazing-thunder.md` section by section:

| Plan section | Change | Finding |
|---|---|---|
| Decisions: Packaging | foundation gets a browser-safe ESM root, and env moves to `@epsilon-asi/foundation/env` | C4 |
| Decisions: Ownership | The logger gains structured fields and `child()`. The chain extraction is deferred until the HTTP binding exists, or designed over 6 parameters | M8, M9 |
| Phase 0 | Add 0.0 (toolchain), described below. Move the casing helpers out of "follow-up" | M1, M2 |
| §1.1 Access flavors | Flavors are null-safe; derived types strip flavors; default detection is structural; `default` joins `SHORTHAND_KEYS` | M4, M5 |
| §1.1 Runtime model | `update` unwraps defaults; `read`/`create`/`update` are variants that nested refs follow | C1, C2 |
| §1.1 / §1.3 | Add `@Resource({ tenant })`, `scope: [...]` chains instead of a full `path`, and `access` from `definePermissions` | C3, C7 |
| §1.3 Endpoints | `void` only when no response is declared; a `failures` default; streaming and proxy endpoint kinds noted as future | M3 |
| §1.4 / §1.5 | The walker contract; the pollution-safe decoder; `stringbool`; `datetime({ offset: true })`; multipart reserved | M7, M13 |
| §2.2 Middleware | Middleware `needs` contract fields instead of owning them; an `authenticate` system step provides `ctx.principal`; principal-keyed rate limits | C6, C7, M13 |
| §2.3 Routes | Replace `routes()` with `group({ use }).routes(group.handler(Endpoint, { use }, fn), …)` | C5 |
| §2.4 Pipeline | Authenticate before decoding the body; strict requests; cross-tenant 404s | M13 |
| §2.1 Runtime | Split readiness from liveness; Express 5 keep-alive drain | M14 |
| §3 ORM | `EntityOf<C>` mapped to `Opt`/`Hidden`; one stated internal cast; migrations as the production default; unit of work as a transaction | M6 |
| Phase 4 | TanStack Query underneath; entity-named exports; form `extend`/`refine`; submit through RHF `handleSubmit` | M12 |
| Phase 5 | `schedule()` jobs; `idempotent`; DLQ defaults; subscription provisioning; `defineStateMachine` | M10, M11 |
| Verification | Type tests in CI; a consumer fixture against built `.d.ts`; named security tests | M2, M13 |

- **Done when:** the plan reflects every row, and every question in §3 is answered or marked deferred.

### Step 3: Phase 0, expanded
- **Status:** carried into the plan's Phase 0, with pnpm instead of npm workspaces, and the chain (0.3) moved to run with Phase 2. Not started.

**0.0 Toolchain** (new)
- [ ] Root `package.json` gets `workspaces: ["packages/*"]`.
- [ ] CI builds foundation first and links it, so `apps` no longer waits on an npm release.
- [ ] foundation's tsconfig moves to `module`/`moduleResolution: node16`, or `nodenext` with ESM, and compiles on TS 5.9 and TS 7.
- [ ] Type tests become part of `typecheck` in every package, so CI runs them.

**0.1 Browser-safe foundation**
- [ ] foundation ships ESM (or dual ESM/CJS) with `sideEffects: false`.
- [ ] The root exports only the decorators, types, naming, logging and chain.
- [ ] `/env` and `/files` are subpaths.
- [ ] `check:browser` runs in foundation, using esbuild with `platform: 'browser'` and a metafile scan.

**0.2 Logging and naming**
- [ ] Move them as planned.
- [ ] `Logger` gains `(message, fields?)`, `child(bindings)`, error serialization and a JSON writer.
- [ ] Ship `toCamelCase`, `toPascalCase` and `toSnakeCase` now.

**0.3 Chain**
Pick one option and record why in the plan:
- [ ] **(a)** Defer the extraction. Build the HTTP binding on a copy of the core, then extract once two bindings exist.
- [ ] **(b)** Extract now, generic over 6 parameters: base context, reserved keys, needed inputs, stop value, chain result and terminal run. Include `resolve.ts`'s ordering, and keep one identity set per binding.

**0.4 `@Prop` additions**
- [ ] Add the shorthands as planned.
- [ ] Add `default` to `SHORTHAND_KEYS`.
- [ ] Move the `aiTool` intent from the retired `validatable.ts` into the plan.

**0.5 Re-tool `apps`**
- [ ] As planned.

**Done when:** `npm run typecheck && npm test && npm run build && npm run check:browser` passes in foundation, command-line and apps on TS 5.9 and TS 7, with no npm release in between.

### Step 4: spikes (each about a day; run before Phase 1)
- **Status:** carried into the plan's Spikes. S2 became Phase 0.0 and 0.1, S4 now covers four ownership kinds, and S6 (resource inheritance) was added. Not started.

| Spike | Question | Done when |
|---|---|---|
| S0: route typing | Does the chosen server call site type `ctx` from group and route `use`, reject wrong returns, and reject bad endpoint references? | The T12 matrix passes on TS 5.9 and TS 7 against the real `Endpoint` types (§9) |
| S1: derivation | Do PATCH and nested projection behave? | `UpdateX.Request.parse(oneKey)` returns one key. A nested `WriteOnly` field never appears in a response, a message or a serializer |
| S2: foundation packaging | Is foundation ESM, browser-safe and TS 7-clean? | Step 3's 0.0 and 0.1 checks pass on a branch |
| S3: MikroORM | Do `em.create`, `assign`, serialization, array/json operators and `FilterQuery` work with flavored classes? | `ResourceService.create` compiles with one stated cast; `EntityOf<C>` makes `ctx.em.create` correct; SQLite and Postgres both run |
| S4: principal and tenancy | Do Offering (direct), SalesThread (transitive) and Channel (user-owned) each scope correctly from the declarations alone? | Org A can't read or write org B's rows for all three, with no hand-written handler |
| S5: shutdown | Does an Express 5 drain work with keep-alive clients, and does readiness flip first? | An in-flight request completes, new connections are refused, and the process exits before the timeout |

### Step 5: the re-sequenced program
- **Status:** superseded by the plan's "Program order", which adds Phase 6 (the kits) and stand-ins for work that lands later.

| Order | Phase | What changes from the current plan |
|---|---|---|
| 1 | Phase 0 (expanded) | Step 3 |
| 2 | Spikes S0–S5 | New |
| 3 | Phase 1: core and contracts | Adds `tenant`, `scope` chains, `definePermissions`, the principal types, the derivation fixes and the walker contract |
| 4 | Phase 1.5: thin UI spike | New: one form and the client against the example resource, before Express. It exercises the flat `Request`, the envelope and 422 mapping from the browser |
| 5 | Phase 2: Express | The group-bound handlers, `authenticate`, `needs`, the security defaults and readiness |
| 6 | Phase 3: MikroORM | Tenant filters from declarations, scope chains through relations, migrations, a transactional unit of work |
| 7 | Phase 4: React | Built on TanStack Query, with entity-named exports and a DataTable built from list caps |
| 8 | Phase 5: messaging and jobs | `schedule()`, idempotency, DLQ defaults, provisioning, state machines and the outbox |

### Step 6: acceptance tests that prove the tenets
- **Status:** carried into the plan's "Verification" section, including the fixture `common` package that imports every root export.
- **Contract drift:** renaming a field in the class must break compilation at the handler, the client `Call`, the form `Field`, the ORM query and the list caps. Use one `@ts-expect-error` per layer in a fixture app.
- **Browser safety:** `check:browser` passes on both `apps` and an example `common` package that imports every root export.
- **Consumer view:** type tests run against the built `.d.ts` from a fixture package, not against `src`.
- **Security, as named tests:**
  - prototype-pollution keys rejected;
  - cross-tenant 404;
  - no auth leads to 401 *before* any 422;
  - nested write-only fields never leak;
  - strict requests reject forbidden fields;
  - webhook replay rejected.

---

## 3. Open questions

| # | Question | Blocks | Answer |
|---|---|---|---|
| Q1 | **Authorization:** are ordered per-org roles enough, or do you want named permissions (policies) and field-level write rules (e.g. only admins may change `role`)? | Phase 1 (`definePermissions`), Phase 2 | Access maps declared in `common` are the default: ordered roles, optional named permissions, conditional rules, field-level write rules, ownership rules and entitlements. Hand-written role middleware stays easy. (Plan: Decisions, 1.3) |
| Q2 | **Tenancy:** is the tenant always Organization? How are user-owned resources (Channel) and cross-org entities (Prospect, Company) scoped? | Phase 1 (`tenant`, `scope`), S4 | The tenant is configurable (Organization, Project, …) and travels in a header. Everything a tenant owns, and shared data, is reached through a tenant; a user's own `'account'` rows are the one exception. User-owned rows use `own()`; shared rows need a tenant context plus an access rule, usually an entitlement. Account and staff endpoints are explicit scopes. (1.3) |
| Q3 | **The unmarked-field default:** should an unmarked field stay *editable*, or should sensitive fields be opt-in writable? | Phase 1 (access presets) | Hidden and never writable. A field is readable or writable only when it says so. (Decisions, 1.1) |
| Q4 | **PATCH semantics:** does `null` clear a field? Are arrays replaced or merged? | Phase 1 (update derivation) | A sent key replaces the value, `null` clears a nullable field, and arrays are replaced. A field can declare `patch: 'merge'` or `'append'`. (Decisions) |
| Q5 | **Requests:** strict (422 on unknown or forbidden fields), or strip? | Phase 1 (schemas), Phase 2 | Strict: 422 naming the field. (Decisions) |
| Q6 | **Infrastructure:** is production Postgres (with pgvector) only? GCP (Cloud Run, Pub/Sub, Secret Manager)? These decide the test database, the rate-limit store, tracing, secrets, and Cloud Tasks versus a DB jobs table. | Phase 2, 3, 5 | Postgres everywhere an app runs, configured by URI and credentials; this repo never provisions production databases. SQLite only in unit and integration tests. Cloud-agnostic base classes; GCP first, AWS later. Jobs use a Postgres table. (Decisions, Cloud providers, Phase 5) |
| Q7 | **The maxleads migration path:** a rewrite, or incremental adoption? Adoption means MikroORM 5.9 → 7, legacy decorators → TC39, and class-validator → zod. Is a coexistence period needed? | Phase 1 (compatibility), every phase | Neither. maxleads is a reference, not a migration target. (Context) |
| Q8 | **The envelope:** must it stay compatible with maxleads' clients? `BaseSuccessCodes` is `[200]`, so the existing UI treats 201 as an error. | Phase 1 (envelope) | No compatibility required. (Decisions: Envelope) |
| Q9 | **ORM options in the browser:** is it acceptable for the browser contract to carry `orm` options (column names, indexes)? | Phase 1 (extensions) | No. ORM mapping is server-only `defineEntity`. (Decisions, 3.1) |
| Q10 | **Chain extraction:** can it wait until the HTTP binding exists? | Phase 0.3 | Yes. It runs with Phase 2, alongside the HTTP binding. (Decisions, 0.3) |
| Q11 | **React data layer:** is a TanStack Query dependency acceptable? | Phase 4 | Yes, underneath our own API; callers never import it. (Decisions, Phase 4) |
| Q12 | **i18n:** is it a requirement? If so, `ui` labels must be keys from day one. | Phase 1 (`ui` extension) | Required. UI text is message keys from day one. (Decisions, 1.11) |
| Q13 | **Streaming:** are LLM or SSE responses in scope for `endpoint()`, or a separate kind? | Phase 1 (envelope), Phase 2 | In scope, as the `stream` endpoint kind (SSE). (Decisions, 2.6) |
| Q14 | **Repo tooling:** may the repo adopt npm workspaces, and may foundation go ESM? | Phase 0.0, 0.1 | pnpm workspaces, and every package goes ESM. (Decisions, 0.0, 0.1) |
| Q15 | **The maxleads vulnerabilities (§10):** who owns them, and should they be fixed before any migration work? | Step 0 | Out of scope for this repo. maxleads isn't being rebuilt; its security issues matter here only for code carried into foundations. (Context, Security requirements) |

---

## 4. Review: critical findings (would cause rework or block the vision), ranked

### C1 · A PATCH resets every defaulted field (a)
- **Plan section:** §1.1 "Runtime model", where the derived `read`/`create`/`update` schemas are "built with `.pick`/`.partial`"; the Offering example (`links`, `status`).
- **Problem:** in zod 4 a `.default()` inside `.optional()` still fires. A `.partial()` update schema therefore fills defaults for every absent key.
- **Evidence:** T5 #1. `Offering.pick({name, links, status}).partial().parse({ name: 'renamed' })` returns `{"name":"renamed","links":[],"status":"DRAFT"}`.
- **Consequence:**
  - With the plan's own example, every `UpdateOffering` that sends only `name` resets `status` to DRAFT and clears `links`.
  - The same applies to every resource with defaults, and to every facet form that edits one section of an aggregate.
  - The data loss is silent and sits on the most common write path.
- **Recommendation:**
  - Derive `update` from the field schema with the `default`, `prefault` and `catch` wrappers removed (`_zod.def.innerType`) before `.optional()`.
  - Add a runtime test: `UpdateX.Request.parse(oneKey)` returns exactly that key plus the scope and id params.
  - Call sites don't change.

### C2 · Response projection doesn't reach nested types, so write-only fields leak (a)
- **Plan section:** §1.3 "Response projection … `Internal`/`WriteOnly` fields can never leak".
- **Problem:** strip mode applies only to the top-level picked object. A nested field is `ref()`, which is the *full* object of the target class.
- **Evidence:**
  - `fnd/packages/foundation/src/decorators/types/typeRegistry.ts:202-204` (`ref` is `z.lazy(() => model(target()).object)`).
  - T5 #4: the parent's read schema returns `owner.passwordHash`.
  - T3: MikroORM's `EntityDTO<Offering>` keeps `vectorStoreId`, so `toObject()`, `JSON.stringify(entity)` and logs leak as well.
- **Consequence:**
  - The first nested resource or embeddable with a `WriteOnly`/`Internal` field leaks it, and relation `expand` makes nesting routine.
  - maxleads' `UFChannel` hand-hid `credentials` and `nylas_grant`. That is the kind of data the new projection must protect.
- **Recommendation:**
  - Each resource model owns `read`/`create`/`update` variants, and a nested ref inside a variant points at the *same variant* of its target (`refRead`). `ReadModel` recurses the same way.
  - Test: a nested `WriteOnly` value never appears in a response, a message payload or a log serializer.

### C3 · Tenant isolation is opt-in, and only one hop deep (b)
- **Plan section:**
  - §1.3 "Scope fields … the ORM adapter applies them as `where` constraints. That closes the tenant-scoping gaps".
  - §2.2 definition-time checks.
  - §3.5 "Path scopes can bind to a relation's foreign key".
- **Problem 1:** a scope param constrains rows to *the org the caller names*. Nothing requires a route with `:organizationId` to run a middleware that proves membership in that org. The plan's only check runs the other way: "a middleware that owns a path param can only be used on routes whose path has that param".
- **Problem 2:** scoping binds one field. maxleads' tenancy is transitive: a Thread belongs to a Campaign, which belongs to an Org, and Prospect and Company have no org FK at all.
- **Evidence:**
  - 25 of maxleads' 93 authenticated routes have no `Authorization`.
  - About 20 cross-org paths look rows up by `threadId`, `messageId` or `meetingId` alone, e.g. `ml/common/src/services/Entities/MessageService.ts:145-157` and `ml/api/src/services/SalesThreadService.ts:66-68`.
  - `ml/common/src/services/Entities/ProspectService.ts:50-55` looks prospects up by id only.
- **Consequence:**
  - The framework rebuilds maxleads' main security failure by construction: forget `use` and every org is readable.
  - Nested resources can't be scoped without hand-written handlers, which defeats `crudHandlers`.
- **Recommendation:** make tenancy a declared property of the resource and of the scope chain, and enforce it in the layer, including in workers:
  ```ts
  @Resource({ tenant: () => Organization })           // ResourceService always filters by it
  export class SalesThread { /* … */ campaign!: Ref<SalesCampaign>; }

  export const { GetSalesThread, ListSalesThreads } =
    endpoints(SalesThread, { name: 'SalesThread', scope: [Organization, SalesCampaign] });
  // path:  /organizations/:organizationId/sales-campaigns/:salesCampaignId/sales-threads[/:salesThreadId]
  // where: { campaign: { id: salesCampaignId, organization: organizationId } }
  ```
  - At definition time, every scope param must be claimed by an *authorizing* middleware, or the route must be marked `public`.
  - `createApi` refuses to start while any non-public route is unauthenticated.

### C4 · foundation's root entry isn't browser-safe, and its CommonJS build prevents tree-shaking (a)
- **Plan section:** Decisions, "Packaging: the root entry is browser-safe (zod and foundation only)"; §0.4; the `check:browser` verification.
- **Evidence:**
  - `fnd/packages/foundation/src/index.ts:2` re-exports `./decorators/environment`.
  - `decorators/environment/dotenv.ts:1-3` imports `node:fs`, `node:path` and `dotenv`.
  - `fnd/packages/foundation/tsconfig.json:4` sets `"module": "commonjs"`.
  - T7: `esbuild --platform=browser` on `import { createTypeRegistry } from '…/foundation/build/index.js'` fails with `Could not resolve "node:fs"`, `"node:path"`, `"path"` and `"crypto"` (the last from dotenv).
- **Consequence:**
  - `check:browser` fails on day one.
  - A lenient bundler (Vite stubs Node built-ins) would ship dotenv to the UI, and it crashes once anything calls it.
  - Tenets 3 and 4 fail in the base layer, not in `apps`.
- **Recommendation:**
  - foundation ships as ESM with `sideEffects: false`.
  - The root entry holds only the decorators, types, naming, logging and chain. Env moves to `@epsilon-asi/foundation/env`, next to the existing `/files` entry.
  - foundation runs the same `check:browser`.
  - Browser call sites don't change. Node code changes one import path.

### C5 · The plan's `routes()` shape can't type per-route `use` (a)
- **Plan section:** §2.3 and the target call site in "One resource, end to end".
- **Evidence:**
  - **T10, Formulation A** (the plan's exact shape: a sibling `use`, and per-endpoint `{ use, handle }`). Group `use` types `ctx`, but per-route `use` does not: `TS2339: Property 'canEdit' does not exist on type 'BaseCtx & { organization… }'`.
  - **T10, Formulation B** (a reverse-mapped per-endpoint type parameter). It infers `ctx`, but it accepts a misspelled endpoint key and skips return checking for a zero-parameter handler.
  - **T12, Formulation E** (a group-bound `handler(Endpoint, { use }, fn)`). All six assertions pass on TS 5.9 and on TS 7:
    - group `ctx` is typed;
    - route `ctx` is typed;
    - `ctx` is not `any`;
    - per-route `ctx` is isolated;
    - the return type is checked for both handler kinds;
    - there is no endpoint key to misspell.
- **Consequence:** the drift tenet 5 exists to kill ("nothing ties a controller's declared context to what its route provides") comes back at the most repeated server call site.
- **Recommendation:** adopt E. Line count is the same as the plan's.
  ```ts
  const offerings = group({ use: [orgRole.Viewer] });
  export const OfferingRoutes = offerings.routes(
    offerings.handler(CreateOffering, { use: [orgRole.Editor] }, async (request, ctx) => { /* … */ }),
    offerings.handler(ListOfferings, async (request, ctx) => { /* … */ }),
  );
  // with the ORM: offerings.routes(...crud(Offering endpoints), offerings.handler(UpdateOffering, …))
  ```

### C6 · Request fields owned by middleware split the contract (a)
- **Plan section:** §2.2: "`request` names the fields this middleware owns … merged into every route that uses the middleware".
- **Problem:**
  - Endpoints live in `common`, and they are what the client `Call`, forms and OpenAPI see. Middleware lives in `api`.
  - So any non-path field a middleware owns is invisible to the browser contract.
  - The CLI analogy only holds because a CLI has no client half.
- **Evidence:** maxleads shows the symptom already. `UpdateSalesCampaignSalesTacticsDetails` puts `organizationId` in the body while authorization reads `request.organizationId` (`ml/api/src/middleware/authorization/AuthorizationMiddleware.ts:77`).
- **Consequence:**
  - The typed client can't send these fields, forms can't validate them, and OpenAPI leaves them out.
  - "One contract" breaks exactly for the cross-cutting fields: org header, idempotency key, API version.
- **Recommendation:**
  - Middleware *needs* fields that the contract declares, rather than owning them:
    ```ts
    defineMiddleware({ name: 'organization', needs: { organizationId: z.uuid() }, handle })
    ```
  - `group()` checks `needs ⊆ RequestOf<E>`, both at the type level and at definition time.
  - Cross-cutting headers go into endpoint presets in `common`, e.g. `endpoint({ …, headers: Idempotent })`.

### C7 · There is no principal or permission model, and roles are server-only objects (b)
- **Plan section:**
  - §2.6 example middleware: `authenticated` reads from a stub token map, and `orgRole.{Viewer,…}` lives in `api/src/middleware`.
  - The naming table's "grouped levels as objects (`orgRole.Editor`)".
- **Problem:** the plan's only authorization primitive is an ordered role compared in server middleware. maxleads already needs more than that:
  - user sessions;
  - bot tokens scoped to a meeting and an org;
  - agent sessions;
  - billing and entitlement gates;
  - role checks in the UI.

  A SaaS builder also needs API keys and service principals.
- **Evidence:**
  - The bot JWT carries `meetingId` and `organizationId`, and `botAuthorization` is never set.
  - UI role gating is written inline in two styles, e.g. `ml/ui/src/pages/organization/organization-settings/general-settings.tsx:31` versus `organization-settings.tsx:34`.
  - Billing gates sit in `ml/common/src/services/Entities/OrganizationService.ts:128-159`.
  - ✔ `PermissionsAreGreaterThan` falls through its switch, so ADMINISTRATOR fails every check and `Verify.Admin` is owner-only (`ml/api/src/middleware/authorization/AuthorizationMiddleware.ts:52-66`).
- **Consequence:**
  - Several later pieces need a principal: `ctx`, the scope checks, audit fields (`createdBy`), rate-limit keys, entitlements and AI-tool authorization.
  - Designing those in Phases 2–5 without one guarantees rework.
  - Role logic stays duplicated between the API and the UI.
- **Recommendation:**
  - `ctx.principal` is a union, `UserPrincipal | BotPrincipal | ApiKeyPrincipal | ServicePrincipal`, provided by a system `authenticate` step.
  - Permissions are data in `common`, so both sides use them, and routes lose their `use: [orgRole.X]` line:
    ```ts
    export const OrgAccess = definePermissions({
      roles: ['VIEWER', 'EDITOR', 'ADMINISTRATOR', 'OWNER'],          // ordered
      grants: { 'offering.write': 'EDITOR', 'offering.delete': 'ADMINISTRATOR' },
    });
    endpoints(Offering, { name: 'Offering', scope: [Organization], access: { write: 'offering.write', delete: 'offering.delete' } });
    // ui:  const can = useCan();  can('offering.delete')
    ```

---

## 5. Review: major findings

### M1 · Phase 0 can't meet its own acceptance: TS 7, the release loop and CI (a/b)
- **Plan section:** §0.5, Risk 6, Verification.
- **Evidence:**
  - TS 7 on `fnd/packages/foundation/tsconfig.json` fails with `TS5108: Option 'moduleResolution=node10' has been removed` (line 16). So "foundation's type tests must pass on both" is impossible with this config.
  - There are no npm workspaces, and CI installs every package from npm (`fnd/.github/workflows/validate.yml:109`).
  - `release.sh` requires main, a clean tree and a branch in sync with origin (`fnd/scripts/release.sh:31`).
  - The foundation dependency ranges are `^0.0.6` in command-line and `^0.0.5` in apps (`package.json:39` and `:53`). On 0.0.x, a caret pins the exact patch.
- **Consequence:** every foundation change that Phases 1–5 need has to be released from main before `apps` CI can go green.
- **Recommendation:**
  - Add a Phase 0.0: move foundation to `node16` module resolution, or to ESM with `nodenext`.
  - Add root `workspaces`.
  - Have CI build foundation first and link it.

### M2 · The type tests that prove tenet 5 don't run in CI (b)
- **Evidence:**
  - foundation's `typecheck` runs `tsc --noEmit` with `exclude: ["src/**/*.type-test.ts"]` (`fnd/packages/foundation/tsconfig.json:19`).
  - CI runs only typecheck, test and build (`validate.yml:132-145`).
  - The plan keeps `typecheck` and `typecheck:tests` as separate scripts for `apps`.
- **Recommendation:**
  - Fold the type tests into `typecheck`; command-line's tsconfig already includes its tests.
  - Also typecheck a consumer fixture against the *built* `.d.ts`. T9 shows why: an inferred signature that references a non-exported type fails with TS4023.

### M3 · A `void` handler return makes the client type lie (a)
- **Plan section:** §2.3 ("`void` means an empty success") together with the §1.6 envelope `data?`.
- **Problem:** if a handler may return void for an endpoint whose `ResponseData` is `ReadModel`, the client's success type must be `data?: ReadModel`. Either every caller null-checks, or the type is wrong.
- **Evidence:**
  - The Phase 2 example handlers return nothing for Create, Get and List.
  - maxleads' `SuccessResponse` turns falsy data into `{}` (`ml/common/src/reqres/common/response/BaseSuccessResponse.ts:18-27`).
- **Recommendation:**
  - Allow `void` only for endpoints with no declared response.
  - Have the log-only handlers return a stub built from the request.
  - `data` is then required on success.

### M4 · Detecting defaults from `z.input`/`z.output` is wrong in both directions (a)
- **Plan section:** §1.1 "`Defaulted` … detected statically: `z.input` admits `undefined` and `z.output` doesn't".
- **Evidence (T2):**
  - It demands `Defaulted<>` on `z.coerce.number()`, `z.preprocess(…)` and `registry.ref(() => X)` (TS1240).
  - It does not detect `z.string().catch('x')`, which does fill a missing value at runtime.
- **Recommendation:**
  - Detect defaults structurally: the outer wrapper chain contains `ZodDefault` or `ZodPrefault`.
  - Give the shorthands a literal `default` key through `const` generics.
  - Add `default` to `SHORTHAND_KEYS` (`typeRegistry.ts:71`). Otherwise it is resolved as an unknown extension and throws (`typeRegistry.ts:419-425`).

### M5 · Flavors drop `null`, leak into every derived type, and break type-bridge (a)
- **Evidence:**
  - **T1:** `Generated<Date | null>` is identical to `Date & {…}`. The `null` disappears because `null & {…}` reduces to `never`.
  - **Error messages:** users see `Defaulted<UpdateOnly<OfferingStatus>>` and `OfferingStatus.DRAFT & { readonly [write]?: "update" … }`.
  - **T13:** type-bridge emits `Generated = NewType("Generated", T)` and `Generated[str]`. `T` is undefined there and `NewType` is not subscriptable, so the Python is invalid, and it reports no diagnostics.
- **Recommendation:**
  - Define `Flavor<T, F> = T extends null | undefined ? T : T & F`, which distributes over the union.
  - Strip flavors from derived types (`RequestOf`, `ReadModel`, form values). Brands stay only on the class.
  - Generate Python from the wire JSON Schema (`io: 'input'`), or strip flavors before calling type-bridge.

### M6 · MikroORM doesn't understand the flavors (c)
- **Evidence (T3 and T3b):**
  - `em.create(Offering, …)` fails with "missing the following properties … links, status, vectorStoreId, createdAt".
  - MikroORM's own `Opt` and `Hidden` brands are `unique symbol`s (`@mikro-orm/core/typings.d.ts:196-224`). `common` can't reference them without importing MikroORM.
  - A generic `toMikroOrmFind<T>` needs a cast.
  - Array fields need MikroORM's array operators.
- **Recommendation:**
  - Use one stated, internal cast in `ResourceService`.
  - Provide an adapter type, `EntityOf<C>`, that maps flavors to `Opt`/`Hidden` for handlers that use `ctx.em` directly.
  - Widen the ORM spike (S3) to cover `em.create`, `assign`, serialization and the array/json operators (`$contains`, `$overlap`).

### M7 · The wire-codec walker's contract is underspecified (c)
- **Evidence (T5):**
  - `.meta()` is lost on every node the walker replaces (#3b).
  - A naive walk of a recursive `lazy` doesn't terminate (#6).
  - `z.coerce.boolean('false')` is `true`, and `z.coerce.number('')` is `0` (#5).
  - `z.iso.datetime()` rejects a `+02:00` offset (#2f).
  - `z.toJSONSchema(z.date())` throws, so foundation's `ResolvedType.jsonSchema()` throws for any class with a date field. OpenAPI must use the wire schemas with `io: 'input'` (#2c–e).
  - `.pick()` and `.partial()` throw on objects with refinements, so cross-field rules have no home (#7).
  - maxleads' own date coercion was `new Date(Number(raw))`.
- **Recommendation:** specify the walker:
  - memoize lazies, and emit a lazy for each;
  - copy registry metadata onto replacement nodes;
  - use `z.stringbool()` and a strict numeric parse;
  - use `z.iso.datetime({ offset: true })`;
  - apply resource-level `refine` *after* the per-operation derivation;
  - test every supported zod kind.

### M8 · The chain extraction leaves out most of what differs between bindings (c)
- **Evidence:**
  - The CLI chain's result type is public API: `ChainResult { exitCode }` (`fnd/packages/command-line/src/middleware/types.ts:70-75`), asserted at `tests/middleware.test-d.ts:39-40`.
  - Reserved keys are hard-coded (`compose.ts:21`, `types.ts:43`).
  - Ordering and de-duplication live in `resolve.ts:58-118`, which the plan doesn't move, although §2.2 relies on them.
  - The identity WeakSet (`define.ts:16`) must exist per binding, or a CLI middleware can be passed to an HTTP route.
  - `MiddlewareContext` is defined on top of `CommandContext` (`types.ts:52-67`).
  - The planned definition-time check "Two middleware can't provide the same key" is impossible as designed:
    - what a middleware provides is type-only (`[providesMarker]?`, `types.ts:110`);
    - the runtime check happens per run (`compose.ts:192-199`);
    - `ProvidedBy` silently intersects duplicate keys.
- **Consequence:** the generic core gets redesigned as soon as HTTP middleware needs to read the response (timing, logging, caching, ETag). "Public API unchanged" then holds only through adapters.
- **Recommendation:**
  - Make the core generic over six things: base context, reserved keys, needed inputs, stop value, chain result and the terminal run.
  - Include `resolve.ts`'s ordering in the move.
  - Or build the HTTP binding first on a copy of the core, and extract once two bindings exist.
  - If a definition-time duplicate check is wanted, declare provided keys at runtime: `provides: ['organization']`.

### M9 · The logger being promoted is CLI-shaped (b)
- **Evidence:**
  - `Logger` is `{ level, debug(message: string), info, warn, error }` (`command-line/src/types.ts:46-53`), and it writes `[level] message` lines (`logging.ts:23-39`).
  - maxleads logs through `console.*` with a broken level order, so `warn` never prints.
- **Recommendation:**
  - Add `(message, fields?)`, `child(bindings)`, error serialization, redaction and a JSON writer with GCP `severity`.
  - The HTTP chain and the consumer chain bind `traceId`.
  - The CLI keeps its text writer.

### M10 · Workers: the queuer is misread, and the failure policy lacks what hurt maxleads (a/b)
- **Evidence:**
  - The queuer is a *delayed-job queue* over four tables. It polls with `findOne` and no lock, an unapproved row blocks everything behind it, and publish-then-delete is not atomic.
  - There is no idempotency anywhere. Paid side effects happen before the flush: Uplead unlocks, Stripe meter events, Nylas sends.
  - Subscription config exists only in a dev script, with no dead-letter queue (`ml/common/src/scripts/initPubSub.ts:36-77`).
  - `ScheduledProspectAnalysisEvent` rows are never consumed.
  - Pausing a campaign doesn't stop pipelines that are already running.
- **Recommendation:**
  ```ts
  await schedule(ScheduledEmail, { messageId }, { at: sendAt });    // durable jobs table, claimed FOR UPDATE SKIP LOCKED
  export const ScheduledEmailHandler = consumer(ScheduledEmail, {
    use: [unitOfWork, idempotent, campaignIsRunning],               // idempotent: message-id ledger in the same transaction
    handle: async (message, ctx) => { /* … */ },
  });                                                               // default: maxAttempts 5, then the dead-letter topic
  await runConsumer({ consumers: [ScheduledEmailHandler] });        // checks or provisions subscriptions from the declarations
  ```
  - `loop()` stays for genuinely periodic work, and takes a lease.
  - A CI check: every topic has a consumer.

### M11 · State machines are modelled as editable fields (b)
- **Evidence:**
  - The plan's own example declares `status: Defaulted<UpdateOnly<OfferingStatus>>`.
  - maxleads' campaign status can move from any state to any state except DRAFT (`ml/api/src/services/SalesCampaignService.ts:172-222`).
  - The workers ignore PAUSED.
  - The "startable" rule exists three times.
- **Consequence:** a PATCH can set any status, bypassing guards and side effects.
- **Recommendation:**
  ```ts
  export const CampaignLifecycle = defineStateMachine(SalesCampaign, 'status', {
    start: { from: ['DRAFT', 'PAUSED'], to: 'RUNNING', guard: isStartable },
    pause: { from: ['RUNNING'], to: 'PAUSED' },
  });
  export const { StartSalesCampaign, PauseSalesCampaign } = transitions(CampaignLifecycle, { name: 'SalesCampaign' });
  ```
  - `status` becomes `Generated`.
  - The transitions produce action endpoints, events and a worker guard middleware.

### M12 · The React layer targets things maxleads didn't use and skips what it needs (c)
- **Evidence:**
  - `CreateQueryProvider` has exactly one consumer, and it holds no page or filter state.
  - `OfferingProvider` is never used.
  - Pages call `X.Call(` directly 92 times across 61 files.
  - List state lives in the DataTable hooks. The page doesn't reset on a filter change, and nothing is synced to the URL.
  - Four `UIRequest` classes exist for form-only fields such as `confirmPassword`.
  - Submit bypasses RHF's `handleSubmit`, and `staticOpts.onSubmit` beats the prop (`form-provider.tsx:70-78`).
- **Recommendation:**
  - Build on TanStack Query. Cache keys are the endpoint `Name` plus the request, and mutations invalidate the resource's lists automatically from endpoint metadata.
  - Derive entity-named exports through template literals, so nothing needs renaming:
    ```ts
    export const { OfferingsProvider, OfferingsContext, useOfferings } = CreateQueryProvider(ListOfferings);
    ```
  - Forms get `extend`/`refine` for form-only fields and submit through RHF's `handleSubmit`.
  - List state is synced to the URL.
  - The DataTable is built from the list caps.

### M13 · Security defaults that have to be stated (b/c)
1. **Validation runs before authentication** in the plan's pipeline: §2.4 step 2 (decode, validate, 422) precedes step 3 (the chain, which includes auth). maxleads does the same.
   - Unauthenticated callers get schema-level 422 details, and bodies are parsed before auth.
   - Authenticate before decoding the body.
2. **The new bracket decoder** must reject `__proto__`, `constructor` and `prototype`, and build null-prototype objects. maxleads' version of the same code is exploitable (§10). Make this a named test.
3. **Rate limiting:**
   - a memory store is per process, so with N replicas the limit is N times higher;
   - without `trust proxy`, IP keys put every user in the load balancer's bucket (`ml/api/src/middleware/ratelimit/RateLimiterMiddleware.ts:31-34`).

   Key on the principal, require explicit proxy config, and make a shared store pluggable.
4. **Requests should be strict, not strip.** Strip silently drops `id`, `organizationId` and `type`-on-update (T5 #8). Return 422 instead.
5. **Webhooks:** enforce timestamp tolerance, check all signatures, compare in constant time and dedup event ids. maxleads' Recall check reads only the first signature and accepts replays. Ship prebuilt verifiers.
6. **Other defaults:**
   - return 404, not 403, across tenants;
   - never return Postgres `detail`;
   - set body and upload size limits;
   - put `/metrics` behind auth;
   - never send stack traces (maxleads' unset `NODE_ENV` does).

### M14 · Health and shutdown (c)
- **Readiness and liveness:** split them, and flip readiness first when draining.
- **Express 5 keep-alive:** `server.close()` waits for keep-alive connections, so call `closeIdleConnections()`, then `closeAllConnections()` when the timeout hits.
- **The cited model has bugs:** `AsyncWorkerManager` in `agents/api.py` never reads its `stop_event`, and `asyncio.wait([])` raises when no workers are running. Use it as inspiration, not as a spec.

---

## 6. Review: minor findings

- **`crudHandlers(Offering)`** can't return handlers keyed `CreateOffering`, because a class type carries no name. Map handlers by endpoint *kind* instead.
- **`ui.options`** can't be typed against the enum's values through extensions, because `FieldInputOf` is fixed per extension (`types.ts:68-79`). Special-case it in the strict `Prop.enum`.
- **`http.in` per field is the wrong level.** The same field is body in Create and query in List.
- **Casing:**
  - The `List<P>` response key (`<camelPlural>`) and `:${Uncapitalize<N>}Id` need runtime camelCase in Phase 1, but the casing helpers are scheduled as a follow-up.
  - `Uncapitalize<'APIKey'>` is `aPIKey`. Pick one rule for type level and runtime.
- **The `${N}s` plural default** breaks for Company, Address and Status. Warn at definition time on s, x, y, ch and sh endings.
- **`ClientFailureResponse` with `4xx`** overlaps 401, 403, 404, 409 and 422, so `code` stops discriminating the union. Use `Exclude`.
- **Paging:** cursor paging is missing (maxleads pages vector-store files by cursor).
- **Filter operators:**
  - `$eq: null` or `$exists` for nullable fields;
  - array/json operators;
  - `$ilike` on a Date passes MikroORM's types (T3), so the plan's own `Where` must keep restricting it.
- **No endpoint kinds for `ANY` proxies (3 in maxleads) or streaming responses.**
- **Declaration emit:** every type that appears in an inferred signature must be exported (T9: TS4023 on a non-exported `Endpoint`).
- **zod version skew:** foundation's dev install is 4.6.7, apps has 4.4.3 and root has 4.4.2. Test the floor of the peer range.
- **The class-name check survives minification for esbuild** (T8). Vite 8's Oxc and SWC are not verified. Make the `name` literal the source of truth.
- **ID generation is unspecified:** uuid v7 in the layer, or a DB default.
- **Retiring `decorators/validation/validatable.ts`** also drops its `aiTool` intent (lines 30-33, 63-66). Carry it in the plan.
- **`/health`** must bypass auth and rate limiting.
- **Composite keys are forbidden** (the "two `id` fields" error), so memberships need a surrogate id. Say so.
- **SQLite can't test** the pgvector, jsonb and `ilike` behaviour maxleads relies on. Default to Postgres via testcontainers, and use SQLite only for speed.

---

## 7. maxleads coverage

| Mechanism | Verdict | Evidence / note |
|---|---|---|
| Request pipeline: Pre/Post × Validation/Authentication/Authorization/Resolution | **Improved**, with one flaw kept | The chain plus `defer` replaces the 12-slot array (`RouteWrapperRemake.ts:187-237`). Validation-before-auth is carried over (M13.1). |
| Flows and context growth | **Improved**, but the call site isn't proven | Typed `next({…})` fixes `AuthFn<…, AuthenticatedRequestContext>` (`Flow.ts:9-16`) and the skipped n-2 step (✔ `Flow.ts:51`). Per-route typing fails in the plan's shape (C5). |
| Verify and roles | **Improved**, but sharing is lost | Ordered roles fix the ✔ ADMINISTRATOR fall-through. Roles stay server-only (C7). |
| Rate limiting | **Covered**, but underspecified | Attached by default, which fixes "computed, never attached" (`RouteWrapperRemake.ts:130-138`). Keys and store: M13.3. |
| Uploads | **Lost** (deferred) | maxleads has 2 upload routes with multer and no `limits`. Reserve multipart in the wire format now. |
| Webhooks | **Improved** | `webhook()` unifies Stripe, Recall and Nylas. Replay and dedup are missing. |
| Error parsing | **Improved** | `defineErrors` carries codes. ORM mappers drop Postgres `detail`. NotFound becomes 404 (it was a 500). |
| EntityService, ServiceManager, FindManyRepository | **Improved**, with one misreading | `ResourceService` replaces 10 org-scoped copies. maxleads' unit of work has no transactions and some native writes; make it a transaction. |
| FindMany filter, sort, paging | **Improved**, with losses | Typed caps, multi-sort, and no regex from user input. Cursor paging is lost. |
| UF* DTOs | **Improved**, but leaky | Projection is automatic, but nested types leak (C2). |
| reqres namespaces and Call/APIService | **Improved** | Fixed members are kept. Client instances fix the global axios clobber. `UIRequest` and `ANY`-method routes are lost. |
| Form provider, useForm | **Improved** | 422 issues map to fields, fixing the dropped field errors (`form-provider.tsx:89-100`). |
| Fields, presets, text maps | **Improved** | The `ui` extension replaces presets and `*TextMapping`. i18n is absent in both. |
| Query provider and data table | **Misunderstood** | The query provider had one consumer. Real list state lived in DataTable hooks. The data table needs a design, not a port. |
| Entity contexts | **Covered** | maxleads' org comes from localStorage, not the URL. The billing redirect gate is lost. |
| Events | **Improved** | `defineEvents` replaces 4 drifting registries (`events/index.ts:15-68`). |
| Pub/Sub consumers | **Improved**, but incomplete | The failure policy fixes parse-outside-try and NotFound-neither-acked-nor-nacked (`BaseHandler.ts:35-80`). DLQ, idempotency and provisioning are missing. |
| Queuer loops | **Misunderstood** | It is a delayed-job queue, not loops (M10). |
| Env | **Covered** | foundation `@Env` replaces `ProcessEnvVars`. Secrets are not addressed. |
| Logging | **Covered**, but thin | M9. |
| Metrics and health | **Partly** | Only health. maxleads has an unused prom-client service and an unauthenticated `/metrics`. |
| Generators | **Improved** (removed by derivation) | A scaffolder is a follow-up. |
| Test helpers | **Improved**, with losses | maxleads' worker tests are stale. Seed factories are lost. |
| gen-py-classes | **Follow-up, currently broken** | Its replacement, type-bridge, emits invalid Python for flavors (T13). |
| Bot and agent auth | **Lost** | C7. |
| Realtime agent tools from `common` | **Lost** | This is the `aiTool` intent. |
| Facet updates and wizards | **Covered** | `fields(C, […])` for the 7 SalesCampaign section PATCHes. |
| Billing gates and entitlements | **Lost** | `authorizeBillingAccount` (`OrganizationService.ts:128-159`). |

---

## 8. Missing capabilities for the SaaS-builder goal

| Capability | Where it belongs | Does the plan block or allow it? |
|---|---|---|
| **AuthN:** sessions, refresh and revocation, SSO with `state`, API keys, service, bot and agent principals | `identity` kit in `apps` root; server in `/express` and `/mikro-orm` | **Blocks until `ctx.principal` exists (C7).** |
| **AuthZ:** roles, permissions, field-level write rules | `definePermissions` in `apps` root, shared with the UI | **Partly blocks:** roles are server middleware objects. |
| **Orgs, memberships, invitations** | Resource kit in `apps` root plus a mailer | Allows. Surrogate ids only. |
| **Multi-tenancy** | `@Resource({ tenant })`, scope chains, ResourceService | **Partly blocks:** only one-hop path scopes (C3). |
| **Billing, entitlements, feature flags** | `/billing` (Stripe peer); `requires('feature')`; `useEntitlement` | Allows. |
| **Notifications and email** | `/notifications`: `defineEmail`, transports, an in-app notification resource | Allows. Needs the outbox and jobs. |
| **Files and uploads** | A `file` field kind in the wire codec; `/uploads` storage adapters; presigned URLs | Allows, *if* multipart is reserved now. |
| **Jobs and scheduling** | `/jobs` (DB-backed delayed jobs, cron) | **The plan misreads it** (M10). |
| **Audit:** createdBy/lastUpdatedBy, history | A unit-of-work hook fed by `ctx.principal` | Blocks until a principal exists. |
| **Soft delete and archival** | `@Resource({ softDelete })` turned into an ORM filter | Allows. |
| **Search** | A `$search` list cap (Postgres full-text or pgvector) | Allows. |
| **Admin and back-office UI** | `<ResourceAdmin>` derived from `ui` plus endpoints | Allows. Needs a super-admin principal. |
| **OpenAPI and SDKs** | Root, built from the *wire* schemas with `io: 'input'` | Allows (T5: decoded `z.date()` throws). |
| **Tracing and metrics** | OpenTelemetry in `/runtime`; `traceparent` propagated into Pub/Sub attributes | Allows. |
| **Migrations, seeding, test kits** | `/mikro-orm` migrations as the production default, `defineSeed`, `createTestApp` | Partly covered. Add migrations now. |
| **Config and secrets** | foundation `/env` plus secret providers, with log redaction | Allows. |
| **i18n and text maps** | `ui` labels as message keys | **Blocks** if labels stay as literals (Q12). |
| **Per-plan rate limits** | Principal keys plus entitlements | Allows, after identity. |
| **Outbound webhooks** | Kit on jobs and the outbox (signing, retries) | Allows. |
| **AI tools derived from resources** | `toTools(endpoints)` in root; in-process invoke as the principal | Allows. Restore the `aiTool` intent. |
| **Python interop** | JSON Schema to pydantic, or type-bridge after stripping flavors | **Blocked as-is** (T13). |
| **Streaming (LLM, SSE) and proxies** | Endpoint kinds `stream(schema)` and `proxy({ allow })` | **The envelope model blocks streaming** (Q13). |
| **Bulk operations, optimistic concurrency, idempotency keys** | Endpoint presets; an `orm` `version` option | Allows. |

---

## 9. Verified and refuted claims (scratch evidence)

**Where the scratch files live:** `/private/tmp/claude-501/-Users-chris-EpsilonASIWorkspace-foundations/09bba153-8e8f-4cae-84c2-887ee474306e/scratchpad/tc/`. That directory is temporary and may be cleared on reboot, so the outputs are recorded here.

**What they run against:**
- zod 4.4.3 and @mikro-orm/core 7.1.4, through `fnd/packages/apps/node_modules`;
- TS 5.9.3 (root) and TS 7.0.2 (command-line);
- foundation's real source, through path mapping;
- react-hook-form 7.52 from maxleads, read only.

| # | Claim | Result | Output |
|---|---|---|---|
| T1 | Flavors accept plain values, can be detected, and yield exact Create/Update/Read with optional modifiers intact | **Verified, with caveats** | Key sets are exact. `?` survives only with homomorphic mapping (`[K in keyof C as …]`). `Generated<Date \| null>` drops `null`. |
| T2 | A strict `@Prop` with `const` generics enforces flavor ⇔ option both ways; foundation's `TypeAgreement` doesn't | **Verified.** The default heuristic is **refuted** | All 5 `Bad` cases error; foundation's own `Prop` accepts mismatches. False positives on `coerce`, `preprocess` and `ref`; `.catch` is missed. |
| T3 | MikroORM 7's `FilterQuery`/`QueryOrderMap` accept flavored classes; the translator needs no casts | **Accepts: verified. Cast-free: refuted for the generic implementation** | Valid queries compile; wrong operands and unknown keys are rejected; `$ilike` on a Date is not rejected. `Where<T>` → `FilterQuery<T>` fails for generic `T`. Array fields fail. `em.create` demands Generated/Defaulted fields. |
| T4 | Compile time is acceptable on 30+ field classes | **Verified** | 8 × 60 fields, cyclic dot paths: check 0.33 s (TS 5.9), 0.07 s (TS 7). Relation-heavy at depth 3: 0.54 s / 0.36 s. |
| T5 | zod 4.4 codecs plus walking definitions cover the wire needs | **Partly** | Codecs work. PATCH defaults fire; nested projection leaks; meta is lost; recursion doesn't terminate; `coerce.boolean('false')` is `true`; `toJSONSchema(z.date())` throws; `pick`/`partial` on refined objects throw. |
| T6 | RHF `FieldPath` works on flavored request types | **Verified** | Exact path union, including `links.${number}`. |
| T7 | The root entry is browser-safe | **Refuted** | esbuild: `Could not resolve "node:fs"`, `"node:path"`, `"path"`, `"crypto"`. |
| T8 | The class-name check survives minification | **Verified for esbuild only** | "class name = Offering" with `--minify --target=es2022`. |
| T9 | Declaration emit of `export const {…} = endpoints(…)` across packages | **Works only if every type is exported** | TS4023 on a non-exported `Endpoint`. |
| T10 | `routes()` infers `ctx` from group plus route `use` | **Refuted for the plan's shape** | A: TS2339 on `ctx.canEdit`. B: misspelled key and zero-parameter return accepted. C (`handler()`): passes. |
| T11 | A per-endpoint `handler()` typed by the contextual return type | **Inconclusive** | The group context is inferred as `unknown`. |
| T12 | A group-bound `handler(Endpoint, { use }, fn)` | **Verified** on TS 5.9 and TS 7 | All 6 assertions pass. |
| T13 | type-bridge produces the Python models | **Refuted** for flavored types | `Generated = NewType("Generated", T)` and `id: Generated[str]`, with no diagnostics. |
| — | foundation's type tests pass on TS 7 | **Refuted** | TS5108 `moduleResolution=node10 has been removed`. |
| — | The middleware chain moves into foundation with command-line's API unchanged | **Not verifiable without implementing it** | Plausible only through adapters (M8). The definition-time duplicate-key check is refuted. |
| — | The versions the plan lists | **Mostly true** | express 5.3.0 and @mikro-orm/core 7.1.4 confirmed. zod is skewed: 4.4.2 at root, 4.4.3 in apps, 4.6.7 in foundation's dev install. |

**The verified server call site (T12), condensed:**
```ts
interface Group<GCtx> {
  handler<E extends AnyEp, const TUse extends readonly AnyMw[] = []>(
    endpoint: E, options: { use?: TUse }, handle: (request: RequestOf<E>, ctx: GCtx & ProvidedBy<TUse>) => Promise<ResponseDataOf<E> | void | Failure>,
  ): Bound<E>;
  handler<E extends AnyEp>(endpoint: E, handle: (request: RequestOf<E>, ctx: GCtx) => Promise<ResponseDataOf<E> | void | Failure>): Bound<E>;
  routes(...handlers: Bound<AnyEp>[]): Routes;
}
declare function group<const TUse extends readonly AnyMw[] = []>(options: { use?: TUse }): Group<BaseCtx & ProvidedBy<TUse>>;
```

---

## 10. Appendix: maxleads production security issues (outside this plan)

These were found while reading maxleads. They are live in production code and should be triaged on their own (Step 0).

| # | Issue | How confirmed | Where |
|---|---|---|---|
| 1 | **Google accounts can be taken over.** Every Google-created account gets the password `"GOOGLE"`, and `Login` never checks the login type, so `POST /auth { email, password: "GOOGLE" }` logs into any Google account. | ✔ Read the code | `ml/api/src/controllers/UserController.ts:184-190` → `ml/api/src/services/UserService.ts:371-387`; check at `UserService.ts:40-50` |
| 2 | **The query parser has prototype pollution.** `?__proto__.membership.role=OWNER` writes through `Object.prototype`, and `Verify` trusts a truthy `context.membership`, which grants OWNER on every org. | ✔ Simulated the pollution with the verbatim code; the bypass was found by reading | `ml/api/src/middleware/validation/RequestValidationMiddleware.ts:9-16`; `ml/api/src/middleware/authorization/AuthorizationMiddleware.ts:17-36` |
| 3 | **`ANY /v3` is an unauthenticated proxy to Nylas** using the app key, and `NylasProxy` appends a client-chosen path that can reach other grants. | By reading | `ml/api/src/controllers/ChannelController.ts:107-130`; `ml/common/src/services/NylasService.ts:197-216` |
| 4 | **Message approve, send, contents and regenerate are not scoped to the org.** So are meeting bot settings and cancel, campaign status, and disqualify. Send mails from the victim org's mailbox. | By reading | `ml/common/src/services/Entities/MessageService.ts:145-157` and others |
| 5 | **Recall's token goes to Google.** It lands on axios' global default headers, which the Google profile call also uses. | By reading | `ml/common/src/services/APIService.ts:23-38`; `GoogleAuthService.ts:59-64` |
| 6 | **Postgres `detail` (row values) reaches 409/422 response bodies.** | By reading | `ml/api/src/util/ErrorCatchingUtility.ts:43-50` |
| 7 | **Other gaps:** | By reading | — |
|   | – `GET /fix-me` is registered twice, and by reading it would crash the process with any valid JWT | | `ml/api/src/routes/UserRoutes.ts:100-109` |
|   | – multer has no size limits | | — |
|   | – the Recall webhook accepts replays | | — |
|   | – the Nylas challenge echo reflects content | | — |
|   | – `/metrics` on 8093 has no auth | | — |
|   | – hardcoded third-party credentials sit in `common/src/services/Uplead/DevClient.ts:81` and `UpleadGQL.ts:403-424` (values not reproduced here) | | — |
