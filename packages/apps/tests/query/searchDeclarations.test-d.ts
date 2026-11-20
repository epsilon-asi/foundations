import { createTypeRegistry, type ResolvedType } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';
import {
  crudExtension, crudRouteMetadata, cursorListQuerySchema, offsetListQuerySchema,
  type Id, type Internal, type Readable, type ReadModel, type Secret, type Tenant, type WriteOnly,
} from '../../src/index.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class BaseRecord {
  @Prop.uuid({ crud: 'id' }) key!: Id<string>;
  @Prop.uuid({ crud: 'tenant' }) workspaceKey!: Tenant<string>;
  @Prop.string({ crud: 'readable' }) title!: Readable<string>;
}
class Report extends BaseRecord {
  @Prop.number({ crud: 'readable', optional: true }) total?: Readable<number>;
  @Prop(z.array(z.string()), { crud: 'readable' }) tags!: Readable<string[]>;
  @Prop(z.object({ category: z.string() }), { crud: 'readable' }) details!: Readable<{ category: string }>;
  @Prop.string({ crud: 'writeOnly' }) credential!: WriteOnly<string>;
  @Prop.string({ crud: 'internal' }) memo!: Internal<string>;
  @Prop.string({ crud: 'secret' }) token!: Secret<string>;
  @Prop.string() providerId!: string;
}
const model = resolve(Report);
const search = { fields: ['key', 'workspaceKey', 'title', 'total', 'tags', 'details'], mode: 'text' } as const;
const beforeRename = { fields: ['key', 'reportTitle'] } as const;
const includesSecret = { fields: ['title', 'token'] } as const;
const metadata = { name: model.name, fields: model.fields };

for (const build of [offsetListQuerySchema, cursorListQuerySchema]) {
  build({ model, search });
  // @ts-expect-error The saved list still names reportTitle after its rename to title.
  build({ model, search: beforeRename });
  // @ts-expect-error A valid field in a saved declaration cannot hide a secret field.
  build({ model, search: includesSecret });
  // @ts-expect-error A write-only credential has no read grant.
  build({ model, search: { fields: ['credential'] } });
  // @ts-expect-error Search uses immediate field names.
  build({ model, search: { fields: ['details.category'] } });
  build({ model: metadata, search: beforeRename });
  build({ search: beforeRename });
}
crudRouteMetadata({ ...model, list: { search } });
// @ts-expect-error The CRUD list rejects the same stale declaration.
crudRouteMetadata({ ...model, list: { search: beforeRename } });
// @ts-expect-error The CRUD list rejects a saved search on a secret field.
crudRouteMetadata({ ...model, list: { search: includesSecret } });
// @ts-expect-error Internal fields have no read grant.
crudRouteMetadata({ ...model, list: { search: { fields: ['memo'] } } });
// @ts-expect-error Unmarked fields have no read grant.
crudRouteMetadata({ ...model, list: { search: { fields: ['providerId'] } } });
crudRouteMetadata({ ...metadata, list: { search: beforeRename } });
crudRouteMetadata({ name: model.name, list: { search: beforeRename } });

function searchResource<Instance>(resource: ResolvedType<Instance>, fields: readonly (keyof ReadModel<Instance> & string)[]) {
  const search = { fields };
  return [offsetListQuerySchema({ model: resource, search }), cursorListQuerySchema({ model: resource, search })];
}
searchResource(model, ['title', 'tags']);

declare const erased: ResolvedType<unknown>;
offsetListQuerySchema({ model: erased, search: beforeRename });
declare const erasedObject: ResolvedType<object>;
cursorListQuerySchema({ model: erasedObject, search: beforeRename });
declare const dictionary: ResolvedType<Record<string, unknown>>;
crudRouteMetadata({ ...dictionary, list: { search: beforeRename } });

class HiddenReport {
  @Prop.string({ crud: 'secret' }) token!: Secret<string>;
}
// @ts-expect-error A concrete class with only hidden fields has no searchable names.
offsetListQuerySchema({ model: resolve(HiddenReport), search: { fields: ['token'] } });
