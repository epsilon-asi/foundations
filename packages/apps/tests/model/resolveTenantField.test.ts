import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it } from 'vitest';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { httpExtension } from '../../src/model/extensions/http.js';
import { resolveTenantField } from '../../src/model/resolveTenantField.js';
import { ResourceDefinitionError } from '../../src/model/ResourceDefinitionError.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension).use(httpExtension);

it.each(['tenant', { access: 'tenant' }] as const)('resolves the inherited field marked %j with its metadata', crud => {
  class OrganizationRecord {
    @Prop.uuid({ crud, http: { name: 'workspace_key' } }) workspaceKey!: string;
  }
  class Project extends OrganizationRecord {
    @Prop.uuid({ crud: 'id' }) key!: string;
  }

  const model = resolve(Project);
  const tenant = resolveTenantField(model);
  expect(tenant).toBe(model.fields.get('workspaceKey'));
  expect(tenant.extensions.http?.name).toBe('workspace_key');
  expectTypeOf(tenant).toEqualTypeOf<NonNullable<ReturnType<typeof model.fields.get>>>();
});

it('names the model when its organizationId has no Tenant declaration', () => {
  class Project {
    @Prop.uuid({ crud: 'id' }) key!: string;
    @Prop.uuid({ crud: 'readable' }) organizationId!: string;
  }

  const model = resolve(Project);
  expect(() => resolveTenantField(model)).toThrow(ResourceDefinitionError);
  expect(() => resolveTenantField(model)).toThrow(/Project.*requires a Tenant field/);
});

it('names the model and all conflicting Tenant fields, including inherited declarations', () => {
  class OrganizationRecord {
    @Prop.uuid({ crud: 'tenant' }) organizationId!: string;
  }
  class Project extends OrganizationRecord {
    @Prop.uuid({ crud: { access: 'tenant' } }) workspaceKey!: string;
    @Prop.uuid({ crud: 'tenant' }) groupId!: string;
  }

  const model = resolve(Project);
  expect(() => resolveTenantField(model)).toThrow(ResourceDefinitionError);
  expect(() => resolveTenantField(model)).toThrow(/Project.*multiple Tenant fields.*organizationId.*workspaceKey.*groupId/);
});
