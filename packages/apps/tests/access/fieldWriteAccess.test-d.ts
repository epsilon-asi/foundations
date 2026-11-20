import { createTypeRegistry, type ResolvedType } from '@epsilon-asi/foundation';
import { crudExtension, crudRouteMetadata, type CrudRouteMetadataOptions, type Editable, type Id } from '../../src/index.js';
import { member } from './member.fixture.js';

const owner = { write: 'OWNER' };
const bothWrites = { fields: { role: owner, source: owner, revision: owner, password: owner } };
crudRouteMetadata({ ...member, access: bothWrites });

// This declaration worked before accessLevel was renamed to role.
const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class PreviousMember {
  @Prop.uuid({ crud: 'id' }) key!: Id<string>;
  @Prop.string({ crud: 'editable' }) accessLevel!: Editable<string>;
}
const formerAccess = { fields: { accessLevel: owner } };
crudRouteMetadata({ ...resolve(PreviousMember), access: formerAccess });
// @ts-expect-error The saved access rule still refers to the old field name.
crudRouteMetadata({ ...member, access: formerAccess });

const create = { Update: false } as const;
const update = { Create: false } as const;
crudRouteMetadata({ ...member, operations: create, access: { fields: { source: owner, password: owner } } });
crudRouteMetadata({ ...member, operations: update, access: { fields: { revision: owner, password: owner } } });
// @ts-expect-error The inherited field source is only writable on create.
crudRouteMetadata({ ...member, operations: update, access: { fields: { source: owner } } });
// @ts-expect-error A general field rule cannot make an update-only field writable on create.
crudRouteMetadata({ ...member, operations: create, access: { fields: { revision: owner } } });
// @ts-expect-error Delete accepts no writable data fields.
crudRouteMetadata({ ...member, operations: { Create: false, Update: false }, access: { fields: { role: owner } } });

const shared = { ...member, tenancy: 'shared', access: { read: 'VIEWER', write: 'EDITOR', fields: { source: owner } } } as const;
// @ts-expect-error Shared writes are disabled by default.
crudRouteMetadata(shared);
// @ts-expect-error An undefined shared write override retains the disabled default.
crudRouteMetadata({ ...shared, operations: { Create: undefined, Update: true } });
crudRouteMetadata({ ...shared, operations: { Create: { docs: false } } });
crudRouteMetadata({ ...member, operations: { Create: undefined, Update: false }, access: { fields: { source: owner } } });

// @ts-expect-error A valid rule on role does not hide a stale second key on a variable.
crudRouteMetadata({ ...member, access: { fields: { ...bothWrites.fields, ...formerAccess.fields } } });
// @ts-expect-error Fields the server sets are read-only.
crudRouteMetadata({ ...member, access: { fields: { status: owner } } });
// @ts-expect-error The owning tenant is set by the context.
crudRouteMetadata({ ...member, access: { fields: { organizationId: owner } } });
// @ts-expect-error The server supplies the inherited primary key.
crudRouteMetadata({ ...member, access: { fields: { key: owner } } });
// @ts-expect-error Internal fields are hidden.
crudRouteMetadata({ ...member, access: { fields: { staffNote: owner } } });
// @ts-expect-error Secret fields are hidden.
crudRouteMetadata({ ...member, access: { fields: { token: owner } } });
// @ts-expect-error An unmarked field has no write grant.
crudRouteMetadata({ ...member, access: { fields: { providerId: owner } } });
crudRouteMetadata({ ...member, access: { fields: { token: { write: undefined }, key: {} } } });

interface NamedFieldRules {
  readonly role?: { write?: 'OWNER' };
  key: { read: 'VIEWER' };
}
declare const named: { fields: NamedFieldRules };
crudRouteMetadata({ ...member, access: named });
declare const conditionalAccess: { fields: { status: { read: 'VIEWER' } | { write: 'OWNER' } } };
// @ts-expect-error A union can supply a write rule on this read-only field.
crudRouteMetadata({ ...member, access: conditionalAccess });

// Broad declarations keep the definition-time checks for their actual flags or field names.
declare const operations: CrudRouteMetadataOptions['operations'];
declare const dynamicRules: Record<string, typeof owner>;
crudRouteMetadata({ ...shared, operations });
crudRouteMetadata({ ...member, access: { fields: dynamicRules } });
declare const rulesWithKnownField: { [name: string]: typeof owner; status: typeof owner };
// @ts-expect-error The index signature leaves dynamic keys open, while status is a known read-only field.
crudRouteMetadata({ ...member, access: { fields: rulesWithKnownField } });
crudRouteMetadata({ name: member.name, fields: member.fields, access: formerAccess });
crudRouteMetadata({ name: 'Preview', access: formerAccess });
declare const erased: ResolvedType<object>;
crudRouteMetadata({ ...erased, access: formerAccess });
