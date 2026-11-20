import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it } from 'vitest';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { httpExtension } from '../../src/model/extensions/http.js';
import { selectOperationFields } from '../../src/model/selectOperationFields.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension).use(httpExtension);

class TenantRecord {
  @Prop.uuid({ crud: 'id' }) id!: string;
  @Prop.uuid({ crud: { access: 'tenant' } }) organizationId!: string;
}

class Contact extends TenantRecord {
  @Prop.string({ crud: 'readable' }) status!: string;
  @Prop.string({ crud: { access: 'editable', patch: 'replace' }, http: { name: 'display_name' } }) name!: string;
  @Prop.string({ crud: 'createOnly', default: 'inbound' }) source!: string;
  @Prop.string({ crud: { access: 'updateOnly' } }) revision!: string;
  @Prop.string({ crud: 'writeOnly' }) password!: string;
  @Prop.string({ crud: { access: 'internal' } }) staffNote!: string;
  @Prop.string({ crud: 'secret' }) token!: string;
  @Prop.string() providerId!: string;
}

const { fields } = resolve(Contact);

it.each([
  ['read', ['id', 'organizationId', 'status', 'name', 'source', 'revision']],
  ['create', ['name', 'source', 'password']],
  ['update', ['name', 'revision', 'password']],
] as const)('selects fields for %s in inherited declaration order', (operation, names) => {
  const selected = selectOperationFields({ fields, operation });
  expect([...selected.keys()]).toEqual(names);
  for (const name of names) expect(selected.get(name)).toBe(fields.get(name));
  expect(selected.get('name')?.extensions.http?.name).toBe('display_name');
  expectTypeOf(selected).toEqualTypeOf<typeof fields>();
});

it('keeps fields without an access preset hidden regardless of other options', () => {
  class PrivateRecord {
    @Prop.uuid({ crud: { id: true } }) key!: string;
    @Prop.string({ crud: { patch: 'replace' } }) detail!: string;
    @Prop.string({ default: 'pending' }) state!: string;
    @Prop.string({ crud: {} }) note!: string;
  }

  const { fields } = resolve(PrivateRecord);
  for (const operation of ['read', 'create', 'update'] as const) {
    expect(selectOperationFields({ fields, operation }).size).toBe(0);
  }
});
