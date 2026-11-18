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

## Naming

Use the package-root helpers to derive consistent names from a resource or field. They recognize word boundaries in camelCase and PascalCase, split acronyms such as `HTTPServer` into words, and accept separators such as hyphens and underscores.

```ts
import { toCamelCase, toPascalCase, toSnakeCase } from '@epsilon-asi/foundation';

toCamelCase('API_KEY');     // 'apiKey'
toPascalCase('api-key');    // 'ApiKey'
toSnakeCase('HTTPServer');  // 'http_server'
```
