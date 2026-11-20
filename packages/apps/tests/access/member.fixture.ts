import { createTypeRegistry } from '@epsilon-asi/foundation';
import type { CreateOnly, Editable, Id, Internal, Readable, Secret, Tenant, UpdateOnly, WriteOnly } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);

class TenantRecord {
  @Prop.uuid({ crud: 'id' }) key!: Id<string>;
  @Prop.uuid({ crud: 'tenant' }) organizationId!: Tenant<string>;
  @Prop.string({ crud: { access: 'createOnly' } }) source!: CreateOnly<string>;
}

class Member extends TenantRecord {
  @Prop.string({ crud: 'editable' }) role!: Editable<string>;
  @Prop.string({ crud: 'updateOnly' }) revision!: UpdateOnly<string>;
  @Prop.string({ crud: 'writeOnly' }) password!: WriteOnly<string>;
  @Prop.string({ crud: 'readable' }) status!: Readable<string>;
  @Prop.string({ crud: 'internal' }) staffNote!: Internal<string>;
  @Prop.string({ crud: 'secret' }) token!: Secret<string>;
  @Prop.string() providerId!: string;
}

export const member = resolve(Member);
