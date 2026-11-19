# @epsilon-asi/foundation

Foundation requires Zod 4.1.0 or later within major version 4. Version 4.1.0 introduced the codecs used for two-way conversion between wire values and application types. [Zod codecs](https://zod.dev/codecs)

## Decorator mode

Foundation uses standard TypeScript decorators. Leave `experimentalDecorators` unset or set it to `false` in the project that compiles your decorated classes. If a build emits legacy decorators, class definition throws `DecoratorModeError`. Its message names the registry decorator and the compiler setting to change. Rebuild the module containing the decorated class after changing the setting.

## Validated string fields

Use the `Prop` decorator from a type registry to validate UUIDs, email addresses and URLs. Fields are required by default. Pair `optional: true` with an optional TypeScript property.

```ts
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry();

class Contact {
  @Prop.uuid()
  id!: string;

  @Prop.email()
  email!: string;

  @Prop.url({ optional: true })
  website?: string;
}

const contact = resolve(Contact);
contact.parse({ id: '019305d4-ff69-7a9e-b66d-93d661ea8e2f', email: 'ray@example.com' });
```

`contact.jsonSchema()` describes these properties as strings with formats `uuid`, `email` and `uri`, respectively. Only `id` and `email` appear in its `required` list.

The parsed value has type `TypeShape<Contact>`. It preserves the class's string-keyed data fields, including optional and readonly properties, and omits both required and optional methods.

## Enum fields

Use `Prop.enum()` with a TypeScript enum or a list of string literals. For a named list, `as const` preserves the allowed values so the field type can be derived from the same declaration. The parentheses around the decorator expression allow the workspace’s esbuild transform to parse the `enum` method name.

```ts
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry();

enum OfferingStatus {
  Draft = 'draft',
  Active = 'active',
}

const audiences = ['internal', 'public'] as const;

class Offering {
  @(Prop.enum(OfferingStatus, { default: OfferingStatus.Draft }))
  status!: OfferingStatus;

  @(Prop.enum(audiences, { optional: true }))
  audience?: (typeof audiences)[number];
}

const offering = resolve(Offering);
offering.parse({}).status;                   // OfferingStatus.Draft
offering.parse({ status: 'active' }).status; // OfferingStatus.Active
offering.safeParse({ status: 'active', audience: 'unknown' }).success; // false
```

A shorthand's `default` supplies the value when input is missing or `undefined`. The default passes through the field's validators, including format, range and nested-field checks. Declare a defaulted field as required in the parsed type. An explicit value, including `false`, `0` or `''`, takes precedence whenever the field accepts it.

Each parse gets fresh copies of dates, arrays and plain objects in the default. Nested custom class instances keep their identity.

## Naming

Use the package-root helpers to derive consistent names from a resource or field. They recognize word boundaries in camelCase and PascalCase, split acronyms such as `HTTPServer` into words, and accept separators such as hyphens and underscores.

```ts
import { toCamelCase, toKebabCase, toPascalCase, toScreamingSnakeCase, toSnakeCase } from '@epsilon-asi/foundation';

toCamelCase('API_KEY');     // 'apiKey'
toPascalCase('api-key');    // 'ApiKey'
toSnakeCase('HTTPServer');  // 'http_server'
toKebabCase('APIKey');      // 'api-key'
toScreamingSnakeCase('api-key'); // 'API_KEY'
```

## Log levels

Import `LogLevel`, `LOG_LEVELS`, `DEFAULT_LOG_LEVEL` and `isLogLevel` from `@epsilon-asi/foundation` in Node or browser code. The levels in threshold order are `debug`, `info`, `warn`, `error` and `silent`. The default is `info`. Use the type guard to validate an external value.

```ts
import { DEFAULT_LOG_LEVEL, isLogLevel, type LogLevel } from '@epsilon-asi/foundation';

function resolveLogLevel(value: unknown): LogLevel {
  return isLogLevel(value) ? value : DEFAULT_LOG_LEVEL;
}
```

## Structured logging

`createLogger({ level, write, redaction })` sends a `LogRecord` to the supplied writer for each message that meets the threshold. Each method accepts a message and optional fields. Use `child(bindings)` to attach a request ID or other shared fields to a family of records.

```ts
import { createJsonLogWriter, createLogger } from '@epsilon-asi/foundation';

const logger = createLogger({
  write: createJsonLogWriter({ write: line => process.stdout.write(line) }),
  redaction: { keys: ['token'], shouldRedact: key => key.endsWith('Secret') },
});
const request = logger.child({ requestId: 'req_1' });
request.warn('offering unavailable', { offeringId: 'of_1', token: 'private' });
// {"requestId":"req_1","offeringId":"of_1","level":"warn","message":"offering unavailable"}
```

Children share their parent’s threshold, writer and redaction policy. A child can override an inherited field, and fields on a single log call take precedence for that record. The parent and sibling loggers keep their own bindings.

Redaction omits matching properties before any writer receives the record. `keys` matches exact field names and `shouldRedact` checks additional names, including those in bindings, nested objects, array elements and error details. Both rules apply to structured fields. Keep sensitive values in those fields so they can be filtered by name.

Pass an `Error` as a field to include its name, message, stack and cause when present, along with its own enumerable properties. Set `format: 'gcp'` on the JSON writer for Google Cloud Logging, where a warning uses `"severity":"WARNING"`. Both JSON presets emit one line per record and put structured fields at the top level. The record supplies `message` and the preset’s severity key when names overlap.

## Environment

Environment and dotenv APIs now live exclusively at `@epsilon-asi/foundation/env`. Update any package-root imports of `Env`, `EnvVar` or `loadEnv` to use this Node entry. Decorate static fields to describe their types. In a test, pass `source` and `dotenv: false` to read only the supplied values.

```ts
import { Env, EnvVar, loadEnv } from '@epsilon-asi/foundation/env';

@Env({ prefix: 'APP_' })
class AppEnv {
  @EnvVar.number('PORT')
  static port: number;
}

loadEnv(AppEnv, { source: { APP_PORT: '4312' }, dotenv: false });
AppEnv.port; // 4312
```

## Verification

Run `corepack pnpm run typecheck` in this directory to check source, compile-time tests and Jest test files together. Run `corepack pnpm run verify` to include the examples, Jest suite, build and browser check. The browser check bundles the public root with esbuild and typechecks its declarations with DOM libraries and ambient Node types disabled.

Foundation's NodeNext build emits native ES modules. The root, `/env` and `/files` use explicit `.js` paths. Node 22.17 loads the same module through `import` and `require` at each entry.

The package declares `"sideEffects": false` so bundlers can remove unused modules. Using `createDecoratorRegistry` initializes `Symbol.metadata`. If a consumer needs only that initialization, import and call `ensureSymbolMetadata()`. The consumer test bundles a decorated class with esbuild, minifies it, then reads back the class and field metadata.

CI builds foundation twice, once with TypeScript 5.9.3 and once with 7.0.2. It packs each build into a separate tarball. For each tarball, the consumer compiles and runs on both compilers with Zod pinned to 4.1.0, then runs the minified decorator bundle. The consumer exercises structured logging, reads an injected value through `/env` and round-trips a date and a defaulted enum through `/files`.

After the workspace install, run these commands from the repository root to repeat the source and packaged-consumer checks. The fixture install supplies the pinned compilers. `test:builds` creates the archives in a temporary directory.

```sh
corepack pnpm --filter @epsilon-asi/foundation run typecheck
corepack pnpm --filter @epsilon-asi/foundation run build:clean
npm --prefix testing/foundation-consumer ci --install-links
node testing/foundation-consumer/node_modules/typescript7/bin/tsc -p packages/foundation/tsconfig.type-tests.json
npm --prefix testing/foundation-consumer run test:builds
```
