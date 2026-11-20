import type {
  Constructor, NumberPropOptions, PropOptions, StringPropOptions, TypeAgreement, TypeRegistry, TypeShape,
} from '@epsilon-asi/foundation';
import { z } from 'zod/v4';
import type { AccessAxis, DefaultAxis, IdAxis, ReadAxis, SecretAxis, TenantAxis, WriteAxis } from './access.js';
import type { ResourceExtensions } from './createResourceSystem.js';

type Options = PropOptions<ResourceExtensions>;
type Preset<O> = O extends { crud: infer Crud } ? Crud extends { access: infer Access } ? Access : Crud : never;
type Axes<P> = P extends 'editable' | 'createOnly' | 'updateOnly' ? ReadAxis | WriteAxis :
  P extends 'writeOnly' ? WriteAxis : P extends 'readable' ? ReadAxis : P extends 'id' ? ReadAxis | IdAxis :
  P extends 'tenant' ? ReadAxis | TenantAxis : P extends 'secret' ? SecretAxis : never;
type Writes<P> = P extends 'editable' | 'writeOnly' ? 'create' | 'update' :
  P extends 'createOnly' ? 'create' : P extends 'updateOnly' ? 'update' : never;
type DeclaredAxes<O, Default> = Axes<Preset<O>> | (O extends { crud: { id: true } } ? IdAxis : never) |
  (Default extends true ? DefaultAxis : never);
type FieldWrites<Field> = WriteAxis extends keyof NonNullable<Field>
  ? Extract<keyof NonNullable<NonNullable<Field>[WriteAxis]>, 'create' | 'update'> : never;
type Decorator<Value, O, Default, Presets = Preset<O>> = <This, Field>(
  value: undefined,
  context: ClassFieldDecoratorContext<This, Field> & TypeAgreement<Field, Value>
    & TypeAgreement<Extract<keyof NonNullable<Field>, AccessAxis>, DeclaredAxes<O, Default>>
    & TypeAgreement<FieldWrites<Field>, Writes<Presets>>,
) => void;
type DefaultOption<O> = O extends { default: unknown } ? true : false;
type OptionalValue<Value, O> = O extends { default: unknown } ? Value : O extends { optional: true } ? Value | undefined : Value;
type Modifiers<Value> = { optional?: boolean; default?: Value };
type Shorthand<Value, Extra = Options> = <const O extends Extra & Modifiers<Value> = {} & Extra>(
  options?: O,
) => Decorator<OptionalValue<Value, O>, O, DefaultOption<O>>;
type EnumSource = readonly string[] | z.core.util.EnumLike;
type EnumValue<T extends EnumSource> = T extends readonly string[] ? T[number] : T[keyof T];
type HasSchemaDefault<S> = S extends z.ZodDefault | z.ZodPrefault ? true :
  S extends z.ZodOptional<infer Inner> | z.ZodNullable<infer Inner> | z.ZodReadonly<infer Inner> ? HasSchemaDefault<Inner> : false;

/** Resource field decorators check the declared access markers as well as the value's type. */
export interface ResourceProp {
  <S extends z.ZodType, const O extends Options = {}>(schema: S, options?: O):
    Decorator<z.output<S>, O, HasSchemaDefault<S>>;
  string: Shorthand<string, StringPropOptions<ResourceExtensions>>;
  uuid: ResourceProp['string'];
  email: ResourceProp['string'];
  url: ResourceProp['string'];
  number: Shorthand<number, NumberPropOptions<ResourceExtensions>>;
  boolean: Shorthand<boolean>;
  date: Shorthand<Date>;
  enum<const T extends EnumSource, const O extends Options & Modifiers<EnumValue<T>> = {}>(values: T, options?: O):
    Decorator<OptionalValue<EnumValue<T>, O>, O, DefaultOption<O>>;
  nested<C extends Constructor, const O extends Options & Modifiers<TypeShape<InstanceType<C>>> = {}>(target: () => C, options?: O):
    Decorator<OptionalValue<TypeShape<InstanceType<C>>, O>, O, DefaultOption<O>>;
}

export function resourceProp(registry: TypeRegistry<ResourceExtensions>, ref: typeof registry.ref): ResourceProp {
  // Keep foundation's validators and option handling. Only nested needs the resource-aware ref.
  const prop = Object.assign((schema: z.ZodType, options?: Options) => registry.Prop(schema, options), registry.Prop, {
    nested<C extends Constructor>(target: () => C, options: Options & Modifiers<TypeShape<InstanceType<C>>> = {}) {
      const { optional, default: fallback, ...field } = options;
      let schema: z.ZodType = ref(target);
      if (fallback !== undefined) schema = schema.prefault(() => structuredClone(fallback));
      else if (optional) schema = schema.optional();
      return registry.Prop(schema, field);
    },
  });
  return prop as unknown as ResourceProp;
}
