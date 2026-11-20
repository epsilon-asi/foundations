import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, it } from 'vitest';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { httpExtension } from '../../src/model/extensions/http.js';
import { resolveCrudIdField } from '../../src/model/resolveCrudIdField.js';
import { ResourceDefinitionError } from '../../src/model/ResourceDefinitionError.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension).use(httpExtension);

it('returns the inherited resolved ID with its schema and other extension metadata', () => {
  class StoredRecord {
    @Prop.uuid({ crud: 'id', http: { name: 'record_key' } }) key!: string;
  }
  class Account extends StoredRecord {
    @Prop.string({ crud: 'editable' }) label!: string;
  }

  const resource = resolve(Account);
  const id = resolveCrudIdField(resource);
  expect(id).toBe(resource.fields.get('key'));
  expect(id.extensions.http?.name).toBe('record_key');
});

it.each([{ access: 'id' }, { id: true }, { access: 'id', id: true }] as const)(
  'accepts a single key declared with %j', crud => {
    class Account {
      @Prop.uuid({ crud }) key!: string;
      @Prop.string({ crud: { access: 'readable', id: false } }) label!: string;
    }

    expect(resolveCrudIdField(resolve(Account)).name).toBe('key');
  },
);

it('requires a declared ID when a resolved resource is used for CRUD', () => {
  class Report {
    @Prop.string() id!: string;
  }

  const report = resolve(Report);
  expect(report.fields.has('id')).toBe(true);
  expect(() => resolveCrudIdField(report)).toThrow(ResourceDefinitionError);
  expect(() => resolveCrudIdField(report)).toThrow(/Report.*requires an ID/);
});

it('names the resource and each field of a composite key, including an inherited ID', () => {
  class Member {
    @Prop.uuid({ crud: 'id' }) userId!: string;
  }
  class Membership extends Member {
    @Prop.uuid({ crud: { id: true } }) organizationId!: string;
  }

  expect(() => resolveCrudIdField(resolve(Membership))).toThrow(ResourceDefinitionError);
  expect(() => resolveCrudIdField(resolve(Membership))).toThrow(/Membership.*multiple ID fields.*userId.*organizationId/);
});

it.each(['internal', 'secret'] as const)('rejects an ID explicitly marked %s', access => {
  class Credential {
    @Prop.uuid({ crud: { access, id: true } }) token!: string;
  }

  expect(() => resolveCrudIdField(resolve(Credential))).toThrow(ResourceDefinitionError);
  expect(() => resolveCrudIdField(resolve(Credential))).toThrow(`Resource "Credential" cannot use its ${access} field "token" as an ID.`);
});
