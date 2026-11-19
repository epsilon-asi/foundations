import { expectTypeOf } from 'vitest';
import {
  kitBase, Organization, Prop, Resource, TenantResource,
  type CreateInput, type Defaulted, type Editable, type Readable, type ReadModel, type UpdateInput,
} from './resource.fixture.js';

expectTypeOf<Organization['status']>().toEqualTypeOf<Defaulted<Readable<string>>>();
expectTypeOf<ReadModel<Organization>>().toEqualTypeOf<{ status: string; name: string }>();
expectTypeOf<CreateInput<Organization>>().toEqualTypeOf<{ name: string }>();
expectTypeOf<UpdateInput<Organization>>().toEqualTypeOf<{ name?: string }>();
const organization = new Organization();
organization.name = 'ACME';
organization.status = 'active';
expectTypeOf<ReadModel<{ name: Editable<string | null> }>>().toEqualTypeOf<{ name: string | null }>();

class Mismatched extends TenantResource {
  // @ts-expect-error An editable field needs the write flavor as well as the read flavor.
  @Prop.string({ crud: 'editable' })
  label!: Readable<string>;

  // @ts-expect-error The default belongs on the class field's flavor.
  @Prop.string({ crud: 'editable', default: 'new' })
  title!: Editable<string>;

  // @ts-expect-error An unmarked field cannot claim read access.
  @Prop.string()
  note!: Readable<string>;
}

// TypeScript permits this refinement of a string and emits no field declaration for it.
// @ts-expect-error The class decorator checks the original kit field's access.
@Resource()
class ErasedOverride extends TenantResource {
  declare privateCode: Readable<string>;
}

// Without the rejected @Resource() call, class-only projection would promise this private field.
expectTypeOf<ReadModel<ErasedOverride>>().toEqualTypeOf<{ status: string; privateCode: string }>();

// A second extensible base also captures the type of the fields it introduced.
const RegionalResource = kitBase(@Resource() class RegionalResource extends TenantResource {
  @Prop.string()
  regionCode!: string;
});

// @ts-expect-error The intermediate base captures this hidden field in its contract.
@Resource()
class ErasedIntermediateField extends RegionalResource {
  declare regionCode: Readable<string>;
}
