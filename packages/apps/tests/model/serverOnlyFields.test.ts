import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it } from 'vitest';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { serverOnlyFields } from '../../src/model/serverOnlyFields.js';

const { Prop, resolve, ref } = createTypeRegistry().use(crudExtension);

it('lists inherited and local unreadable fields in declaration order', () => {
  class StoredRecord {
    @Prop.uuid({ crud: 'id' }) id!: string;
    @Prop.string() providerId!: string;
    @Prop.string({ crud: { access: 'internal' } }) staffNote!: string;
    @Prop.string({ crud: 'writeOnly' }) password!: string;
    @Prop.string({ crud: { access: 'secret' } }) token!: string;
  }
  class Account extends StoredRecord {
    @Prop.uuid({ crud: 'tenant' }) tenantId!: string;
    @Prop.string({ crud: 'readable' }) status!: string;
    @Prop.string({ crud: { access: 'editable' } }) label!: string;
    @Prop.string({ crud: 'createOnly' }) source!: string;
    @Prop.string({ crud: 'updateOnly' }) revision!: string;
    @Prop.string({ crud: { patch: 'replace' } }) detail!: string;
  }

  const hidden = serverOnlyFields(resolve(Account));
  expect([...hidden]).toEqual(['providerId', 'staffNote', 'password', 'token', 'detail']);
  expectTypeOf(hidden).toEqualTypeOf<ReadonlySet<string>>();
});

it('lists immediate names separately for each referenced resource', () => {
  class Settings {
    @Prop.string({ crud: 'secret' }) signingKey!: string;
  }
  class Account {
    @Prop(ref(() => Settings), { crud: 'readable' }) settings!: Settings;
  }

  expect([...serverOnlyFields(resolve(Account))]).toEqual([]);
  expect([...serverOnlyFields(resolve(Settings))]).toEqual(['signingKey']);
});
