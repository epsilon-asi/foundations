# @epsilon-asi/foundation

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

## Enum fields

Use `Prop.enum()` with a TypeScript enum or a list of string literals. For a named list, `as const` preserves the allowed values so the field type can be derived from the same declaration.

```ts
import { createTypeRegistry } from '@epsilon-asi/foundation';

const { Prop, resolve } = createTypeRegistry();

enum OfferingStatus {
  Draft = 'draft',
  Active = 'active',
}

const audiences = ['internal', 'public'] as const;

class Offering {
  @Prop.enum(OfferingStatus, { default: OfferingStatus.Draft })
  status!: OfferingStatus;

  @Prop.enum(audiences, { optional: true })
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
import { toCamelCase, toPascalCase, toSnakeCase } from '@epsilon-asi/foundation';

toCamelCase('API_KEY');     // 'apiKey'
toPascalCase('api-key');    // 'ApiKey'
toSnakeCase('HTTPServer');  // 'http_server'
```

## Verification

From this package directory, run `npm run typecheck` to check source and compile-time tests together. CI uses the same command. Run `npm run verify` for type checks, examples, runtime tests and the build.
