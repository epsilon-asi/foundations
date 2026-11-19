import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expectTypeOf } from 'vitest';
import { httpExtension } from '../../src/model/extensions/http.js';

const registry = createTypeRegistry().use(httpExtension);

class Contact {
  @registry.Prop.string({ http: { name: 'display_name' } })
  displayName!: string;
}

const contact = registry.resolve(Contact);
const metadata = contact.fields.get('displayName')?.extensions.http;
expectTypeOf(metadata).toEqualTypeOf<{ name?: string | undefined } | undefined>();
expectTypeOf(contact.extensions).not.toHaveProperty('http');
