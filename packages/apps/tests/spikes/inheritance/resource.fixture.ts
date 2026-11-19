import {
  createTypeRegistry, defineTypeExtension, type Constructor, type TypeAgreement, type TypeShape,
} from '@epsilon-asi/foundation';
import { z } from 'zod';

// Only the string shorthand and the access presets exercised by S6.
const crud = z.enum(['readable', 'editable']);
export const registry = createTypeRegistry({ namespace: 'resources' }).use(
  defineTypeExtension({ key: 'crud' as const, field: crud }),
);

declare const read: unique symbol;
declare const write: unique symbol;
declare const defaulted: unique symbol;
type Flavor<T, F> = T extends null | undefined ? T : T & F;
export type Readable<T> = Flavor<T, { readonly [read]?: T }>;
export type Editable<T> = Flavor<Readable<T>, { readonly [write]?: T }>;
export type Defaulted<T> = Flavor<T, { readonly [defaulted]?: true }>;
type Axes<T> = Extract<keyof NonNullable<T>, typeof read | typeof write | typeof defaulted>;

type StringOptions = { crud?: z.infer<typeof crud>; default?: string; min?: number };
type StringAccess<O> = O extends { crud: 'editable' } ? Editable<string>
  : O extends { crud: 'readable' } ? Readable<string> : string;
type StringValue<O> = O extends { default: string } ? Defaulted<StringAccess<O>> : StringAccess<O>;

type StrictField<T> = <This, Value>(value: undefined,
  context: ClassFieldDecoratorContext<This, Value> & TypeAgreement<Value, T> & TypeAgreement<Axes<Value>, Axes<T>>,
) => void;

export const Prop = {
  string<const O extends StringOptions = {}>(options?: O): StrictField<StringValue<O>> {
    // Plain strings are assignable to flavored strings. Strict Prop also compares the phantom keys.
    return registry.Prop.string(options) as StrictField<StringValue<O>>;
  },
};

type PlainValue<T, Axis extends symbol> = T extends null | undefined ? T
  : Axis extends keyof T ? Exclude<T[Axis], undefined> : never;
type Project<T, Axis extends symbol> = {
  [K in keyof TypeShape<T> as Axis extends Axes<T[K]> ? K : never]: PlainValue<T[K], Axis>;
};
export type ReadModel<T> = Project<T, typeof read>;
export type CreateInput<T> = Project<T, typeof write>;
export type UpdateInput<T> = Partial<CreateInput<T>>;

// A kit base carries its own original instance type into the subclass's static type.
// This also covers "declare" overrides, which leave no field decorator metadata.
declare const kitContract: unique symbol;
export function kitBase<C extends Constructor>(target: C): C & { readonly [kitContract]: InstanceType<C> } {
  return target as C & { readonly [kitContract]: InstanceType<C> };
}

type Grants<T> = Extract<Axes<T>, typeof read | typeof write>;
type WiderFields<Base, Child> = {
  [K in keyof Base & keyof Child]: Exclude<Grants<Child[K]>, Grants<Base[K]>> extends never ? never : K;
}[keyof Base & keyof Child];
type PreservesKitFields<C extends Constructor> = C extends { [kitContract]: infer Base }
  ? WiderFields<Base, InstanceType<C>> extends never ? unknown
    : { readonly 'widens inherited field access': WiderFields<Base, InstanceType<C>> }
  : unknown;

export function Resource() {
  return <C extends Constructor>(target: C, context: ClassDecoratorContext<C> & PreservesKitFields<C>) => {
    registry.Type()(target, context);
    context.addInitializer(function () {
      const parent = Object.getPrototypeOf(this);
      if (parent === Function.prototype) return;
      const childFields = registry.resolve(this).fields;
      for (const [name, base] of registry.resolve(parent).fields) {
        const previous = base.extensions.crud;
        const current = childFields.get(name)?.extensions.crud;
        if ((current && !previous) || (current === 'editable' && previous !== 'editable')) {
          throw new Error(`${this.name}.${name} widens inherited access`);
        }
      }
    });
  };
}

export const TenantResource = kitBase(@Resource() class TenantResource {
  @Prop.string({ crud: 'readable', default: 'active' })
  status!: Defaulted<Readable<string>>;

  @Prop.string()
  privateCode!: string;
});

@Resource()
export class Organization extends TenantResource {
  @Prop.string({ crud: 'editable', min: 2 })
  name!: Editable<string>;
}
