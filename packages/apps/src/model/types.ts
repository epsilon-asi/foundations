import type { Constructor, TypeShape } from '@epsilon-asi/foundation';
import type { AccessAxis, DefaultAxis, Defaulted, IdAxis, ReadAxis, SecretAxis, WriteAxis, WriteOperation } from './access.js';

/** The declared data fields of a resource class or instance, including inherited fields. */
export type Fields<C> = C extends Constructor<infer Instance> ? TypeShape<Instance> : TypeShape<C>;

// Match the declared marker key. Plain values are assignable to an Id flavor
// because its phantom properties are optional.
type IdKey<Fields> = {
  [K in keyof Fields]-?: Extract<keyof NonNullable<Fields[K]>, IdAxis> extends never ? never : K;
}[keyof Fields];

// Id<Defaulted<T>> stores the default modifier inside the ID marker.
type WithoutDefault<Value> = Value extends Defaulted<infer T> ? T : Value;

type PlainId<Field> = Field extends null | undefined ? Field
  : IdAxis extends keyof Field ? WithoutDefault<Exclude<Field[IdAxis], undefined>> : never;

// Select the marked field of each model separately when the input is a union.
type IdFromFields<Model> = Model extends unknown ? PlainId<Model[IdKey<Model>]> : never;

/** The plain value of the primary-key field on a resource class or instance. */
export type IdOf<C> = IdFromFields<Fields<C>>;

type FieldAxes<Field> = Extract<keyof NonNullable<Field>, AccessAxis>;
type MemberAxes<Field> = Field extends unknown ? FieldAxes<Field> : never;
type MarkedKeys<Model> = {
  [K in keyof Model]-?: MemberAxes<Model[K]> extends never ? never : K;
}[keyof Model];

type Variant = 'read' | WriteOperation;
type ResourceVariant<Value, V extends Variant> =
  V extends 'read' ? ReadModel<Value> :
  V extends 'create' ? CreateInput<Value> : UpdateInput<Value>;

// Inline JSON records retain their plain keys. Nested resources use the same
// variant as the containing resource, including inside arrays and tuples.
type ProjectPlain<Value, V extends Variant> =
  Value extends string | number | boolean | bigint | symbol | Date ? Value :
  Value extends readonly unknown[] ? { [K in keyof Value]: ProjectValue<Value[K], V> } :
  Value extends Record<string, unknown> ? MarkedKeys<Value> extends never
    ? { [K in keyof Value]: ProjectValue<Value[K], V> }
    : ResourceVariant<Value, V> :
  Value extends object ? ResourceVariant<Value, V> : Value;

type WriteGrant<Value> = NonNullable<Value[WriteAxis & keyof Value]>;
type GrantValue<Value, V extends Variant> = V extends 'read'
  ? Exclude<Value[ReadAxis & keyof Value], undefined>
  : WriteGrant<Value>[V & keyof WriteGrant<Value>];

type ProjectMember<Value, V extends Variant> =
  FieldAxes<Value> extends never ? ProjectPlain<Value, V> :
  SecretAxis extends FieldAxes<Value> ? never :
  ProjectValue<GrantValue<Value, V>, V>;

// An untyped element of an otherwise accessible container has unknown contents.
type ProjectValue<Value, V extends Variant> = 0 extends (1 & Value) ? unknown
  : Value extends unknown ? ProjectMember<WithoutDefault<Value>, V> : never;

// A grant must be present on every non-null member of the field's type.
type GrantedVariants<Field> = SecretAxis extends MemberAxes<Field> ? never
  : (ReadAxis extends FieldAxes<Field> ? 'read' : never)
  | (WriteAxis extends FieldAxes<Field> ? Extract<WriteOperation, keyof WriteGrant<NonNullable<Field>>> : never);

type ProjectFields<Model, V extends Variant> = {
  [K in keyof Model as V extends GrantedVariants<Model[K]> ? K : never]: ProjectValue<Model[K], V>;
};

/** The readable data of a resource, with access flavors removed at each level. */
export type ReadModel<C> = ProjectFields<Fields<C>, 'read'>;

type OptionalDefaults<Model> = {
  [K in keyof Model as DefaultAxis extends FieldAxes<Model[K]> ? never : K]: Model[K];
} & {
  [K in keyof Model as DefaultAxis extends FieldAxes<Model[K]> ? K : never]?: Model[K];
};

// Distribute first so each resource in a union keeps its own keys and defaults.
type CreateFromFields<Model> = Model extends unknown ? ProjectFields<OptionalDefaults<Model>, 'create'> : never;

/** The create-writable data of a resource, with schema-defaulted fields optional. */
export type CreateInput<C> = CreateFromFields<Fields<C>>;

// Optional private keys admit {} and trigger excess-property checking. The
// two alternatives share no key, so keyof still reports no writable fields.
declare const emptyPatchA: unique symbol;
declare const emptyPatchB: unique symbol;
type EmptyPatch = { [emptyPatchA]?: never } | { [emptyPatchB]?: never };

type OptionalPatch<Shape> = Shape extends unknown
  ? keyof Shape extends never ? EmptyPatch : Partial<Shape>
  : never;

/** The update-writable data of a resource. Every field may be omitted from a patch. */
export type UpdateInput<C> = OptionalPatch<ProjectFields<Fields<C>, 'update'>>;
