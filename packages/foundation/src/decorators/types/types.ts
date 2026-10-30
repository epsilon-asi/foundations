import type { z } from 'zod/v4';
import type { AnyFunction, Constructor } from '../factory';

export type ObjectMode = 'strip' | 'strict' | 'loose';

/**
 * The data portion of a class instance: string keys only, methods removed.
 * Modifiers (optional, readonly) are preserved.
 */
export type TypeShape<T> = {
  [K in keyof T as K extends string ? (T[K] extends AnyFunction ? never : K) : never]: T[K];
};

/**
 * Resolves to `unknown` when the field type and the schema output agree exactly,
 * otherwise to a branded object whose property name explains the mismatch.
 */
export type TypeAgreement<TValue, TOutput> = [TValue] extends [TOutput]
  ? [TOutput] extends [TValue]
    ? unknown
    : { readonly 'schema output is wider than the field type': TOutput }
  : { readonly 'field type does not match the schema output': TValue };

export type FieldDecorator<TOutput> = <TThis, TValue>(
  value: undefined,
  context: ClassFieldDecoratorContext<TThis, TValue> & TypeAgreement<TValue, TOutput>,
) => void;

export type AnyFieldDecorator = <TThis, TValue>(
  value: undefined,
  context: ClassFieldDecoratorContext<TThis, TValue>,
) => void;

export type TypeClassDecorator = <TClass extends Constructor>(
  value: TClass,
  context: ClassDecoratorContext<TClass>,
) => void;

type InputOf<TSchema> = TSchema extends z.ZodType ? z.input<TSchema> : never;
type OutputOf<TSchema> = TSchema extends z.ZodType ? z.output<TSchema> : never;

export interface ExtensionDecoratorApi<TFieldInput, TTypeInput> {
  /** Records this extension's options on a field. Must be paired with @Prop in the same class. */
  field(options: TFieldInput): AnyFieldDecorator;
  /** Records this extension's options on a class. */
  type(options: TTypeInput): TypeClassDecorator;
}

/**
 * A concern (http, orm, ai tools, ...) that attaches its own options to types.
 * Option schemas are zod schemas, validated when a type is resolved, never when it is decorated.
 */
export interface TypeExtension<
  TKey extends string = string,
  TField extends z.ZodType | undefined = z.ZodType | undefined,
  TType extends z.ZodType | undefined = z.ZodType | undefined,
  TDecorators extends object = object,
> {
  readonly key: TKey;
  readonly field?: TField;
  readonly type?: TType;
  readonly decorators?: (api: ExtensionDecoratorApi<InputOf<TField>, InputOf<TType>>) => TDecorators;
}

export type AnyTypeExtension = TypeExtension<string, any, any, any>;
export type ExtensionMap = Record<string, AnyTypeExtension>;

export type FieldInputOf<E> = E extends TypeExtension<any, infer F, any, any> ? InputOf<F> : never;
export type FieldOutputOf<E> = E extends TypeExtension<any, infer F, any, any> ? OutputOf<F> : never;
export type TypeInputOf<E> = E extends TypeExtension<any, any, infer T, any> ? InputOf<T> : never;
export type TypeOutputOf<E> = E extends TypeExtension<any, any, infer T, any> ? OutputOf<T> : never;
type DecoratorsOf<E> = E extends TypeExtension<any, any, any, infer D> ? D : never;

export type ExtensionDecorators<E> = Omit<DecoratorsOf<E>, 'field' | 'type'> &
  ExtensionDecoratorApi<FieldInputOf<E>, TypeInputOf<E>>;

type ExtensionFieldOptions<TExt extends ExtensionMap> = {
  [K in keyof TExt as [FieldInputOf<TExt[K]>] extends [never] ? never : K]?: FieldInputOf<TExt[K]>;
};

type ExtensionTypeOptions<TExt extends ExtensionMap> = {
  [K in keyof TExt as [TypeInputOf<TExt[K]>] extends [never] ? never : K]?: TypeInputOf<TExt[K]>;
};

export type ResolvedFieldExtensions<TExt extends ExtensionMap> = {
  readonly [K in keyof TExt as [FieldOutputOf<TExt[K]>] extends [never] ? never : K]?: FieldOutputOf<
    TExt[K]
  >;
};

export type ResolvedTypeExtensions<TExt extends ExtensionMap> = {
  readonly [K in keyof TExt as [TypeOutputOf<TExt[K]>] extends [never] ? never : K]?: TypeOutputOf<
    TExt[K]
  >;
};

export type PropOptions<TExt extends ExtensionMap = {}> = {
  description?: string;
  /** Merged into the field schema's zod metadata, so it reaches z.toJSONSchema. */
  meta?: Readonly<Record<string, unknown>>;
} & ExtensionFieldOptions<TExt>;

export type TypeOptions<TExt extends ExtensionMap = {}> = {
  /** Defaults to the class name. */
  name?: string;
  description?: string;
  /** How unknown keys are handled: z.object (strip), z.strictObject, or z.looseObject. Defaults to 'strip'. */
  mode?: ObjectMode;
  meta?: Readonly<Record<string, unknown>>;
} & ExtensionTypeOptions<TExt>;

export type StringPropOptions<TExt extends ExtensionMap = {}> = PropOptions<TExt> & {
  min?: number;
  max?: number;
};

export type NumberPropOptions<TExt extends ExtensionMap = {}> = PropOptions<TExt> & {
  integer?: boolean;
  min?: number;
  max?: number;
};

type OptionalField = { optional: true };
type RequiredField = { optional?: false };

export interface PropDecorator<TExt extends ExtensionMap = {}> {
  <TSchema extends z.ZodType>(schema: TSchema, options?: PropOptions<TExt>): FieldDecorator<
    z.output<TSchema>
  >;

  string(options: StringPropOptions<TExt> & OptionalField): FieldDecorator<string | undefined>;
  string(options?: StringPropOptions<TExt> & RequiredField): FieldDecorator<string>;

  number(options: NumberPropOptions<TExt> & OptionalField): FieldDecorator<number | undefined>;
  number(options?: NumberPropOptions<TExt> & RequiredField): FieldDecorator<number>;

  boolean(options: PropOptions<TExt> & OptionalField): FieldDecorator<boolean | undefined>;
  boolean(options?: PropOptions<TExt> & RequiredField): FieldDecorator<boolean>;

  date(options: PropOptions<TExt> & OptionalField): FieldDecorator<Date | undefined>;
  date(options?: PropOptions<TExt> & RequiredField): FieldDecorator<Date>;

  /** Sugar for `Prop(registry.ref(target), options)`. */
  nested<TClass extends Constructor>(
    target: () => TClass,
    options: PropOptions<TExt> & OptionalField,
  ): FieldDecorator<TypeShape<InstanceType<TClass>> | undefined>;
  nested<TClass extends Constructor>(
    target: () => TClass,
    options?: PropOptions<TExt> & RequiredField,
  ): FieldDecorator<TypeShape<InstanceType<TClass>>>;
}

export type TypeDecorator<TExt extends ExtensionMap = {}> = (
  options?: TypeOptions<TExt>,
) => TypeClassDecorator;

export interface ResolvedField<TExt extends ExtensionMap = {}> {
  readonly name: string;
  /** The field schema with description and meta applied. */
  readonly schema: z.ZodType;
  readonly description?: string;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly extensions: ResolvedFieldExtensions<TExt>;
}

export interface ResolvedType<TInstance, TExt extends ExtensionMap = {}> {
  readonly target: Constructor<TInstance>;
  readonly name: string;
  readonly description?: string;
  readonly mode: ObjectMode;
  readonly meta: Readonly<Record<string, unknown>>;
  /** The derived object schema, for shape operations (.shape, .pick, .extend, ...). */
  readonly object: z.ZodObject;
  /** The same schema as `object`, typed by the class, for composing into other zod schemas. */
  readonly schema: z.ZodType<TypeShape<TInstance>>;
  /** Fields in declaration order, base class fields first. */
  readonly fields: ReadonlyMap<string, ResolvedField<TExt>>;
  readonly extensions: ResolvedTypeExtensions<TExt>;

  parse(input: unknown): TypeShape<TInstance>;
  safeParse(input: unknown): z.ZodSafeParseResult<TypeShape<TInstance>>;
  jsonSchema(params?: z.core.ToJSONSchemaParams): z.core.JSONSchema.BaseSchema;
}

export interface CreateTypeRegistryOptions {
  namespace?: string;
}

export interface TypeRegistry<TExt extends ExtensionMap = {}> {
  readonly namespace: string;
  readonly extensions: { readonly [K in keyof TExt]: ExtensionDecorators<TExt[K]> };

  readonly Type: TypeDecorator<TExt>;
  readonly Prop: PropDecorator<TExt>;

  /** A lazy reference to another registered type, usable anywhere inside a zod schema. */
  ref<TClass extends Constructor>(target: () => TClass): z.ZodType<TypeShape<InstanceType<TClass>>>;

  resolve<TClass extends Constructor>(target: TClass): ResolvedType<InstanceType<TClass>, TExt>;

  /**
   * Returns a registry that also understands `extension`. Registries derived from the same
   * root share decorations, so classes decorated through one can be resolved through another.
   */
  use<E extends AnyTypeExtension>(extension: E): TypeRegistry<TExt & { [K in E['key']]: E }>;
}
