import { z } from 'zod/v4';
import { createResourceSystem } from '../../src/model/createResourceSystem.js';
import type { CreateOnly, Defaulted, Editable, Id, Readable, Tenant } from '../../src/model/access.js';

const { Prop } = createResourceSystem();
class ResourceFields {
  @Prop.string() hidden!: string;
  @Prop.uuid({ crud: 'id' }) id!: Id<string>;
  @Prop.uuid({ crud: 'tenant' }) tenant!: Tenant<string>;
  @Prop.number({ crud: 'editable', optional: true }) rank?: Editable<number>;
  @Prop(z.string().default('draft'), { crud: 'editable' }) text!: Defaulted<Editable<string>>;
  // @ts-expect-error A validated plain string does not declare any read grant.
  @Prop.string({ crud: 'readable' }) exposed!: string;
  // @ts-expect-error A hidden field cannot claim write access through its type.
  @Prop.string() hiddenWrite!: Editable<string>;
  // @ts-expect-error A readable field and an ID have different grants.
  @Prop.uuid({ crud: 'readable' }) wrongId!: Id<string>;
  // @ts-expect-error CreateOnly and Editable have different update permissions.
  @Prop.string({ crud: 'editable' }) wrongWrite!: CreateOnly<string>;
  // @ts-expect-error A field without a create default must be provided.
  @Prop.string({ crud: 'editable' }) wrongDefault!: Defaulted<Editable<string>>;
  // @ts-expect-error The decorated field value must match the schema.
  @Prop.number({ crud: 'readable' }) wrongType!: Readable<string>;
}
