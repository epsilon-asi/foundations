import { expectTypeOf } from 'vitest';
import type {
  CreateOnly, Defaulted, Editable, Id, Internal, Readable, Secret, Tenant, UpdateOnly, WriteOnly,
} from '../../src/index.js';

type ReadAxis = keyof Readable<object>;
type WriteAxis = keyof WriteOnly<object>;
expectTypeOf<ReadAxis>().toExtend<symbol>();
expectTypeOf<WriteAxis>().toExtend<symbol>();
expectTypeOf<ReadAxis>().not.toBeNever();
expectTypeOf<WriteAxis>().not.toBeNever();
expectTypeOf<Extract<ReadAxis, WriteAxis>>().toBeNever();
expectTypeOf<keyof Editable<object>>().toEqualTypeOf<ReadAxis | WriteAxis>();

type IdAxis = Exclude<keyof Id<object>, ReadAxis>;
type TenantAxis = Exclude<keyof Tenant<object>, ReadAxis>;
expectTypeOf<IdAxis | TenantAxis>().toExtend<symbol>();
expectTypeOf<IdAxis>().not.toBeNever();
expectTypeOf<TenantAxis>().not.toBeNever();
expectTypeOf<Extract<IdAxis, TenantAxis>>().toBeNever();
expectTypeOf<Extract<WriteAxis, IdAxis | TenantAxis>>().toBeNever();
expectTypeOf<Id<number>[ReadAxis]>().toEqualTypeOf<number | undefined>();
expectTypeOf<Tenant<string>[ReadAxis]>().toEqualTypeOf<string | undefined>();
expectTypeOf<Id<number>[IdAxis]>().toEqualTypeOf<number | undefined>();
expectTypeOf<Tenant<string>[TenantAxis]>().toEqualTypeOf<string | undefined>();
expectTypeOf<number>().toExtend<Id<number>>();
expectTypeOf<string>().toExtend<Tenant<string>>();
expectTypeOf<Id<number | null | undefined>>().toEqualTypeOf<Id<number> | null | undefined>();
expectTypeOf<Tenant<string | null | undefined>>().toEqualTypeOf<Tenant<string> | null | undefined>();

type Address = { city: string };
type WriteAddress = { readonly create: Address; readonly update: Address };
expectTypeOf<Readable<Address>[ReadAxis]>().toEqualTypeOf<Address | undefined>();
expectTypeOf<Editable<Address>[ReadAxis]>().toEqualTypeOf<Address | undefined>();
expectTypeOf<Editable<Address>[WriteAxis]>().toEqualTypeOf<WriteAddress | undefined>();
expectTypeOf<WriteOnly<Address>[WriteAxis]>().toEqualTypeOf<WriteAddress | undefined>();
expectTypeOf<CreateOnly<Address>[ReadAxis]>().toEqualTypeOf<Address | undefined>();
expectTypeOf<UpdateOnly<Address>[ReadAxis]>().toEqualTypeOf<Address | undefined>();
expectTypeOf<CreateOnly<Address>[WriteAxis]>().toEqualTypeOf<{ readonly create: Address } | undefined>();
expectTypeOf<UpdateOnly<Address>[WriteAxis]>().toEqualTypeOf<{ readonly update: Address } | undefined>();

type DefaultAxis = keyof Defaulted<object>;
expectTypeOf<DefaultAxis>().toExtend<symbol>();
expectTypeOf<DefaultAxis>().not.toBeNever();
expectTypeOf<Extract<DefaultAxis, ReadAxis | WriteAxis | IdAxis | TenantAxis>>().toBeNever();
expectTypeOf<Defaulted<Editable<Address>>[DefaultAxis]>().toEqualTypeOf<true | undefined>();
expectTypeOf<Defaulted<Editable<Address>>[ReadAxis]>().toEqualTypeOf<Address | undefined>();
expectTypeOf<Defaulted<Editable<Address>>[WriteAxis]>().toEqualTypeOf<WriteAddress | undefined>();
expectTypeOf<keyof Defaulted<Readable<object>>>().toEqualTypeOf<DefaultAxis | ReadAxis>();
expectTypeOf<Address>().toExtend<Defaulted<Editable<Address>>>();
expectTypeOf<Defaulted<Editable<Address | null | undefined>>>()
  .toEqualTypeOf<Defaulted<Editable<Address>> | null | undefined>();

type SecretAxis = keyof Secret<object>;
expectTypeOf<Internal<Address | null | undefined>>().toEqualTypeOf<Address | null | undefined>();
expectTypeOf<keyof Internal<object>>().toBeNever();
expectTypeOf<SecretAxis>().toExtend<symbol>();
expectTypeOf<SecretAxis>().not.toBeNever();
expectTypeOf<Extract<SecretAxis, ReadAxis | WriteAxis | DefaultAxis | IdAxis | TenantAxis>>().toBeNever();
expectTypeOf<Secret<string>[SecretAxis]>().toEqualTypeOf<true | undefined>();
expectTypeOf<string>().toExtend<Secret<string>>();
expectTypeOf<Secret<string>>().toExtend<string>();
expectTypeOf<Secret<string | null | undefined>>().toEqualTypeOf<Secret<string> | null | undefined>();

expectTypeOf<string>().toExtend<WriteOnly<string>>();
expectTypeOf<Address>().toExtend<Editable<Address>>();
expectTypeOf<Address>().toExtend<CreateOnly<Address>>();
expectTypeOf<string>().toExtend<UpdateOnly<string>>();
expectTypeOf<Date>().toExtend<Readable<Date>>();
expectTypeOf<WriteOnly<string>>().toExtend<string>();
expectTypeOf<Editable<Address>>().toExtend<Address>();
expectTypeOf<Readable<Date | null>>().toEqualTypeOf<Readable<Date> | null>();
expectTypeOf<WriteOnly<string | undefined>>().toEqualTypeOf<WriteOnly<string> | undefined>();
expectTypeOf<CreateOnly<Address | null | undefined>>().toEqualTypeOf<CreateOnly<Address> | null | undefined>();
expectTypeOf<UpdateOnly<string | null | undefined>>().toEqualTypeOf<UpdateOnly<string> | null | undefined>();
expectTypeOf<Editable<'draft' | 'live' | null | undefined>>()
  .toEqualTypeOf<Editable<'draft'> | Editable<'live'> | null | undefined>();
