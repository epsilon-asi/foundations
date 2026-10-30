import { z } from 'zod/v4';
import { createTypeRegistry, defineTypeExtension } from '../../index';
import type { TypeShape } from '../../index';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

const http = defineTypeExtension({
  key: 'http',
  field: z.object({ in: z.enum(['body', 'query']).default('body') }),
  type: z.object({ path: z.string() }),
  decorators: (api) => ({
    Query: () => api.field({ in: 'query' }),
    // @ts-expect-error decorators are typed by the field schema
    Cookie: () => api.field({ in: 'cookie' }),
  }),
});

const audit = defineTypeExtension({
  key: 'audit',
  type: z.object({ retainDays: z.number() }),
});

const types = createTypeRegistry().use(http).use(audit);
const { Type, Prop, ref, resolve, extensions } = types;

// --- field type must agree exactly with the schema output ---

@Type({ description: 'agreeing fields' })
class Address {
  @Prop(z.string())
  city!: string;
}

class Good {
  @Prop(z.string().email())
  email!: string;

  @Prop(z.string().optional())
  nickname?: string;

  @Prop(z.enum(['a', 'b']))
  letter!: 'a' | 'b';

  @Prop(z.array(z.string()))
  tags!: string[];

  @Prop(z.object({ a: z.string() }))
  inline!: { a: string };

  @Prop.string({ min: 1 })
  name!: string;

  @Prop.string({ optional: true })
  note?: string;

  @Prop.number({ integer: true })
  rank!: number;

  @Prop.boolean({ optional: true })
  active?: boolean;

  @Prop.date()
  createdAt!: Date;

  @Prop.nested(() => Address)
  home!: Address;

  @Prop.nested(() => Address, { optional: true })
  work?: Address;

  @Prop(z.array(ref(() => Address)))
  previous!: Address[];
}

class Bad {
  // @ts-expect-error schema output is number, field is string
  @Prop(z.number())
  mismatch!: string;

  // @ts-expect-error a required schema cannot fill an optional field
  @Prop(z.string())
  shouldBeOptional?: string;

  // @ts-expect-error field narrower than schema: parsing could produce any string
  @Prop(z.string())
  narrowed!: 'a' | 'b';

  // @ts-expect-error optional shorthand on a required field
  @Prop.string({ optional: true })
  required!: string;

  // @ts-expect-error required shorthand on an optional field
  @Prop.number()
  maybe?: number;

  // @ts-expect-error nested type does not match the field
  @Prop.nested(() => Address)
  wrongNested!: { street: string };
}

// --- nested classes with methods: parsed data has no methods, so the field must say so ---

class WithMethods {
  @Prop(z.string())
  id!: string;

  greet(): string {
    return this.id;
  }
}

class Holder {
  // @ts-expect-error parsed nested values are plain data, not WithMethods instances
  @Prop.nested(() => WithMethods)
  instance!: WithMethods;

  @Prop.nested(() => WithMethods)
  data!: TypeShape<WithMethods>;
}

// --- TypeShape ---

class Shaped {
  id!: string;
  label?: string;
  readonly count!: number;
  run(): void {}
}

type _Shape = Expect<Equal<TypeShape<Shaped>, { id: string; label?: string; readonly count: number }>>;

// --- extension options are typed by each extension's schema ---

@Type({ http: { path: '/x' }, audit: { retainDays: 1 } })
class Typed {
  @Prop(z.string(), { description: 'd', http: { in: 'query' } })
  a!: string;

  @Prop(z.string(), { http: {} })
  b!: string;

  @extensions.http.Query()
  @Prop(z.string())
  c!: string;
}

class BadOptions {
  // @ts-expect-error "cookie" is not a valid http location
  @Prop(z.string(), { http: { in: 'cookie' } })
  a!: string;

  // @ts-expect-error unknown option key
  @Prop(z.string(), { htp: { in: 'query' } })
  b!: string;

  // @ts-expect-error audit has no field-level options
  @Prop(z.string(), { audit: { retainDays: 1 } })
  c!: string;

  // @ts-expect-error shorthand options are checked too
  @Prop.string({ min: 1, http: { in: 'cookie' } })
  d!: string;
}

// @ts-expect-error type-level http options need a path
@Type({ http: {} })
class BadTypeOptions {}

// @ts-expect-error audit retainDays must be a number
@extensions.audit.type({ retainDays: '1' })
class BadStandaloneType {}

// --- resolved values ---

const resolved = resolve(Typed);
const parsed = resolved.parse({});
type _Parsed = Expect<Equal<typeof parsed, { a: string; b: string; c: string }>>;

const location = resolved.fields.get('a')?.extensions.http?.in;
type _Location = Expect<Equal<typeof location, 'body' | 'query' | undefined>>;

const retain = resolved.extensions.audit?.retainDays;
type _Retain = Expect<Equal<typeof retain, number | undefined>>;

// @ts-expect-error audit has no field-level options, so it has no resolved field slot
resolved.fields.get('a')?.extensions.audit;

const composed = z.object({ address: resolve(Address).schema });
type _Composed = Expect<Equal<z.output<typeof composed>, { address: { city: string } }>>;

// @ts-expect-error resolve takes a class
resolve({});

// --- the root registry knows no extensions ---

const root = createTypeRegistry();

class RootOnly {
  // @ts-expect-error http is not registered on the root registry
  @root.Prop(z.string(), { http: { in: 'query' } })
  a!: string;
}

// @ts-expect-error use() takes a type extension
createTypeRegistry().use({ nope: true });

export {
  Address,
  Good,
  Bad,
  Holder,
  Typed,
  BadOptions,
  BadTypeOptions,
  BadStandaloneType,
  RootOnly,
};
export type { _Shape, _Parsed, _Location, _Retain, _Composed };
