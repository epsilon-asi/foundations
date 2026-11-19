import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, it } from 'vitest';
import { httpExtension } from '../../src/model/extensions/http.js';

const { Prop, Type, resolve } = createTypeRegistry().use(httpExtension);

it('records an optional wire name without renaming the model property', () => {
  class Contact {
    @Prop.string({ http: { name: 'display_name' } })
    displayName!: string;

    @Prop.string({ http: {} })
    city!: string;

    @Prop.string()
    email!: string;
  }

  const contact = resolve(Contact);
  expect(contact.fields.get('displayName')?.extensions.http).toEqual({ name: 'display_name' });
  expect(contact.fields.get('city')?.extensions.http).toEqual({});
  expect(contact.fields.get('email')?.extensions.http).toBeUndefined();
  expect(Object.keys(contact.object.shape)).toEqual(['displayName', 'city', 'email']);
});

it('rejects malformed names and field-level locations when resolving the model', () => {
  class InvalidName {
    // @ts-expect-error HTTP wire names must be strings.
    @Prop.string({ http: { name: 123 } })
    value!: string;
  }

  class FieldLocation {
    // @ts-expect-error The endpoint owns the wire location.
    @Prop.string({ http: { name: 'value', in: 'query' } })
    value!: string;
  }

  expect(() => resolve(InvalidName)).toThrow(/Invalid "http" options on field "value"/);
  expect(() => resolve(FieldLocation)).toThrow(/Invalid "http" options on field "value"/);
});

it('rejects HTTP options on the model itself', () => {
  // @ts-expect-error HTTP options only apply to fields.
  @Type({ http: { name: 'contact' } })
  class Contact {}

  expect(() => resolve(Contact)).toThrow('Extension "http" does not accept type-level options');
});
