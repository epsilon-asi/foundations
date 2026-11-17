# Architecture and Philosophy

Everything in this repository is written to be used many times. A design is
measured by how few lines its caller has to write. If keeping the caller small
takes far more code in the layer behind it, we write that code.

## Reuse is assumed

Treat every pattern here as one that will repeat across many call sites,
packages and applications. The point where an abstraction pays for itself has
already been reached, so don't weigh it case by case. This replaces the usual
advice to wait for a third copy before abstracting, or to prefer a few
duplicated lines to an early abstraction. When you write the first instance of
something that will recur, build the abstraction with it and write the
instance on top.

## Where the lines go

The end user of a layer is whatever code calls it. `foundation` serves
`command-line`, `command-line` serves `agent-engineer`, and every package
serves the applications built on it.

A layer is written once and called many times. A line saved at the call site is
saved at every call site, and a fix in the layer reaches every caller. Count
lines where a layer is used. The layer itself can be as large and intricate as
that requires. Lines are saved by moving work into a layer. Call sites keep
their normal formatting.

Give each concern one owning layer. When a call site needs setup, wiring or
boilerplate that other call sites also need, move it into that layer, so each
caller passes only what is specific to it.

`command-line` is thousands of lines so that `agent-engineer`'s root command
and `bin` entrypoint can be this short:

```ts
@Command({ package: import.meta.url, commands: [InfoCommand, QueryCommand] })
export class AgentEngineer {}

await runMain(AgentEngineer);
```

From those lines the layer reads the CLI's name, version and description from
package.json, adds `-l, --log-level` with an `AGENT_ENGINEER_LOG_LEVEL`
variable, builds help, parses `process.argv`, runs the matching command, prints
errors and sets the exit code.

## Extract, abstract, extrapolate

### Extract

Code that repeats, or will, belongs in one function, base class or module that
every caller uses. `toButtons()` and `toFields()` in
[slack/src/prebuilt/shared.ts](../packages/slack/src/prebuilt/shared.ts) serve
every prebuilt Slack message. [`CliCommand`](../packages/command-line/src/base/command.ts)
gives every command `--format` and `render()`.

### Abstract

Put extracted code behind an interface that asks for what the caller wants and
keeps how it gets done inside the layer. A command in `agent-engineer` is a
class with `@Command` and `@Option` decorators, and it never imports
commander. A Slack alert is `message().alert({ title, message, severity }).build()`,
and the layer produces the Block Kit JSON, the fallback text and the limit
checks.

### Extrapolate

Generalize from the instances you have to the ones that will follow, so each
new instance supplies only its own details. `alertCard()`, `budgetAlert()` and
a dozen more prebuilt Slack messages are each an options interface mapped onto
the general [`card()`](../packages/slack/src/prebuilt/card.ts). When a shape
works, carry it to the next problem: `createCliSystem()` copies the shape of
`createEnvSystem()`, and both are built on `createDecoratorRegistry()` from
`foundation`.

### Processes

Repeated processes get the same treatment. The root `npm run build`, `test` and
`install` run in every package through
[scripts/run_for_packages.sh](../scripts/run_for_packages.sh). Package `bump`
scripts call the shared [scripts/bump_version.sh](../scripts/bump_version.sh),
and [scripts/release.sh](../scripts/release.sh) bumps, commits and tags any set
of packages in one command. Each tag then publishes its package through CI.

## Inputs

### Default every input you can

Require an input only when the layer has no way to work it out. Resolve each
value in this order:

1. Derive it from what the layer already has. `command-line` names a command
   after its class (`SyncReposCommand` → `sync-repos`), builds flags from
   property names (`outputDir` → `--output-dir <output-dir>`), and reads the
   CLI's name, version and description from package.json.
2. Default it to what most callers want.
3. Only then, require it.

The common case passes no options: `runMain(App)`,
`AgentEngineerConfig.load()`, `loadEnv(AppEnv)`.

- A value the caller passes always wins over a derived or default one.
- Features most callers want are on by default and switched off with `false`,
  as in `logging: false` and `dotenv: false`.
- Dependencies default to the real thing and stay injectable. `runCli`'s `io`
  defaults to the process streams and `loadEnv`'s `source` to `process.env`;
  tests pass their own.
- Document each default on the field it belongs to: `/** Default: true. */`.
- Export constant defaults by name (`DEFAULT_IMAGE_PULL_POLICY`,
  `DEFAULT_SPINNER`, `DEFAULT_DOTENV_PATH`) so callers, docs and tests can refer
  to them.
- In zod schemas, put `.default()` on every field that can take one, so an
  empty or missing file still parses to a complete value.
  [`GlobalConfigSchema`](../packages/agent-engineer/src/config/global-config.ts)
  does this.

### One options object

A function, factory or decorator takes its inputs as one object, typed by a
named, exported interface. Every key that can be defaulted is optional.

```ts
export interface SyncOptions {
  /** Repository root. Default: process.cwd(). */
  dir?: string;
  /** Attempts per repository. Default: 3. */
  retries?: number;
  /** Push after syncing. Default: false. */
  push?: boolean;
}

export async function sync(options: SyncOptions = {}): Promise<void> {
  const { dir = process.cwd(), retries = 3, push = false } = options;
  // ...
}

await sync();                // the common case
await sync({ retries: 5 });  // only what differs
```

With one object:

- Call sites name each value they pass, in any order, and leave out the rest.
- Adding an option never breaks a caller.
- The type is one name that other types build on, and
  `Parameters<typeof sync>[0]` extracts it from the function itself. In
  `foundation`, `LayeredLoadOptions` extends `Omit<LoadOptions, 'filePath'>`
  and `DiscoverOptions`.
- The function reads every input and its default in one destructuring line.
- The input is plain data, so it can be validated, loaded from a config file,
  merged over defaults with a spread, or passed whole to the next layer.

A single positional argument may come first when it is the subject the call
acts on, as in `runMain(App)` or `loadEnv(AppEnv, { source })`. Everything
else goes in the object.

## Patterns already in use

These recur across packages. Use one of them before inventing another.

| Pattern | Examples |
| --- | --- |
| A `create*System()` factory plus a default instance whose members are exported directly. Callers import `Command` or `EnvVar` and start; the factory is for isolated registries and tests. | `createEnvSystem()` in `foundation`, `createCliSystem()` in `command-line` |
| A `create*()` factory that binds the arguments many calls share. Per-call options merge over the bound ones. | `createLayeredFile()` in `foundation`, used as `AgentEngineerConfig.load()` |
| A `define*()` function that turns a declaration into a typed, reusable unit. | `defineMiddleware()`, `defineComponent()`, `defineActor()` |
| A base class holding what every subclass needs. | `CliCommand` |
| Declarations that the layer wires up. | `@Command`, `@Option`, `@Env`, `@EnvVar` |
| Types inferred from the one declaration, so nothing is typed twice. | `z.infer<typeof GlobalConfigSchema>`, `Provided<typeof client>` |
| Checks at definition time that throw errors naming the class or option at fault, so callers write no defensive code. | `CliDefinitionError`, `MiddlewareError` |

## When existing code differs

Some existing code predates these rules, such as functions that take several
positional arguments. New code follows this document, even where nearby code
differs.
