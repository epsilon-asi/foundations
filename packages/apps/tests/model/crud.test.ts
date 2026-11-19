import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { crudExtension } from '../../src/model/extensions/crud.js';

const { Prop, Type, resolve } = createTypeRegistry().use(crudExtension);

it.each([
  'readable', 'id', 'tenant', 'editable', 'createOnly', 'updateOnly', 'writeOnly', 'internal', 'secret',
] as const)('records the %s preset in shorthand and object form', access => {
  class Contact {
    @Prop.string({ crud: access }) shorthand!: string;
    @Prop.string({ crud: { access } }) expanded!: string;
  }

  const { fields } = resolve(Contact);
  expect(fields.get('shorthand')?.extensions.crud).toBe(access);
  expect(fields.get('expanded')?.extensions.crud).toEqual({ access });
});

it('records ID and PATCH options independently of access', () => {
  class Contact {
    @Prop.uuid({ crud: { id: true } }) id!: string;
    @Prop.string({ crud: { access: 'editable', id: false, patch: 'replace' } }) name!: string;
    @Prop(z.object({ city: z.string() }), { crud: { patch: 'merge' } })
    address!: { city: string };
    @Prop(z.array(z.string()), { crud: { patch: 'append' } }) tags!: string[];
    @Prop.string({ crud: {} }) note!: string;
    @Prop.string() other!: string;
  }

  const { fields } = resolve(Contact);
  expect(fields.get('id')?.extensions.crud).toEqual({ id: true });
  expect(fields.get('name')?.extensions.crud).toEqual({ access: 'editable', id: false, patch: 'replace' });
  expect(fields.get('address')?.extensions.crud).toEqual({ patch: 'merge' });
  expect(fields.get('tags')?.extensions.crud).toEqual({ patch: 'append' });
  expect(fields.get('note')?.extensions.crud).toEqual({});
  expect(fields.get('other')?.extensions.crud).toBeUndefined();
});

it.each([
  'defaulted', { access: 'public' }, { patch: 'delete' }, { id: 'yes' }, { write: true },
])('rejects invalid field metadata %j when resolving the model', crud => {
  class Contact {
    // @ts-expect-error These malformed options simulate unchecked input.
    @Prop.string({ crud }) name!: string;
  }

  expect(() => resolve(Contact)).toThrow('Invalid "crud" options on field "name"');
});

it('rejects class-level CRUD metadata', () => {
  // @ts-expect-error CRUD options only apply to fields.
  @Type({ crud: 'readable' })
  class Contact {}

  expect(() => resolve(Contact)).toThrow('Extension "crud" does not accept type-level options');
});
