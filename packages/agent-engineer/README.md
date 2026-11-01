# @epsilon-asi/agent-engineer

Agent Engineer command-line interface, built on [commander](https://github.com/tj/commander.js) with
[`@commander-js/extra-typings`](https://github.com/commander-js/extra-typings) so option and argument
types are inferred from their declarations.

Requires Node.js 22.12 or later.

## Usage

```sh
npm run dev -- --help             # run from source with tsx
npm run build && npm start -- info
```

```
agent-engineer [--log-level <level>] <command>

  -l, --log-level <level>   debug | info | warn | error (default: info, env: AGENT_ENGINEER_LOG_LEVEL)
  -V, --version             print the version
  -h, --help                print help

Commands:
  info [--format text|json] print CLI and runtime information
```

## Layout

| Path                  | Purpose                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| `src/config.ts`       | All declarations: metadata, env var names, options, option value types    |
| `src/program.ts`      | Wires the declarations into a commander program; `run()` returns exit code |
| `src/commands/*.ts`   | Command handlers, one per command                                         |
| `src/context.ts`      | Injectable stdout/stderr and the context passed to handlers               |
| `src/logger.ts`       | Level-filtered logger writing to stderr                                   |
| `src/main.ts`         | `bin` entrypoint                                                          |

## Adding a command

1. Declare it in `src/config.ts`: add an entry to `commands` with its option factories, and an
   interface for its parsed options.
2. Write the handler in `src/commands/<name>.ts`, taking that interface and a `CommandContext`.
3. Register it in `createProgram()` in `src/program.ts`.
4. Add a check to `tests/types.test-d.ts` that the declared interface matches what commander infers.

## Scripts

| Script                  | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev -- <args>` | Run from source with tsx                             |
| `npm run build`         | Compile to `dist/`                                   |
| `npm start -- <args>`   | Run the compiled CLI                                 |
| `npm run typecheck`     | Type-check `src/`, `tests/` and config               |
| `npm test`              | Run unit tests and type tests (`*.test-d.ts`)        |
| `npm run test:watch`    | Run tests in watch mode                              |
| `npm run test:coverage` | Run tests with v8 coverage (80% thresholds)          |
| `npm run verify`        | Typecheck, test, and build                           |
