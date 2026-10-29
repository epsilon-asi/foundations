export type AnyFunction = (...args: any[]) => any;
export type Constructor<T = unknown> = abstract new (...args: any[]) => T;
export type PublicMemberKey = string | symbol;

export type DecorationKind = 'class' | 'property' | 'method' | 'accessor';

export interface ClassDecoratorDefinition<TMetadata = unknown> {
  metadata: TMetadata;
}

export interface PropertyDecoratorDefinition<TMetadata = unknown, TTarget = unknown> {
  metadata: TMetadata;
  target: TTarget;
}

export interface MethodDecoratorDefinition<
  TMetadata = unknown,
  TTarget extends AnyFunction = AnyFunction,
> {
  metadata: TMetadata;
  target: TTarget;
}

export interface AccessorDecoratorDefinition<TMetadata = unknown, TTarget = unknown> {
  metadata: TMetadata;
  target: TTarget;
}

export type DecoratorSchema = {
  class: Record<string, ClassDecoratorDefinition<any>>;
  property: Record<string, PropertyDecoratorDefinition<any, any>>;
  method: Record<string, MethodDecoratorDefinition<any, AnyFunction>>;
  accessor: Record<string, AccessorDecoratorDefinition<any, any>>;
};

export type MetadataOf<TDefinition> = TDefinition extends { metadata: infer TMetadata }
  ? TMetadata
  : never;

export type TargetOf<TDefinition> = TDefinition extends { target: infer TTarget }
  ? TTarget
  : unknown;

export type StringKeyOf<TObject> = Extract<keyof TObject, string>;
export type MemberKeyOf<TObject> = Extract<keyof TObject, PublicMemberKey>;

export type KeysOfType<TObject, TValue> = {
  [K in MemberKeyOf<TObject>]-?: TObject[K] extends TValue ? K : never;
}[MemberKeyOf<TObject>];

export type MethodKeysOfType<TObject, TValue extends AnyFunction> = {
  [K in MemberKeyOf<TObject>]-?: TObject[K] extends TValue
    ? TObject[K] extends AnyFunction
      ? K
      : never
    : never;
}[MemberKeyOf<TObject>];

export type MetadataArgs<TMetadata> = [TMetadata] extends [undefined]
  ? []
  : [metadata: TMetadata];

export type KeyedMetadataArgs<TKey extends PublicMemberKey, TMetadata> = [TMetadata] extends [undefined]
  ? [key: TKey]
  : [key: TKey, metadata: TMetadata];

export type DirectKeyedMetadataArgs<TKey extends PublicMemberKey, TMetadata> = [
  TMetadata,
] extends [undefined]
  ? [key: never]
  : [key: TKey, metadata: TMetadata];

export interface DecorationRecord {
  id: string;
  kind: DecorationKind;
  decorator: string;
  metadata: unknown;
  memberName?: string | symbol;
  static: boolean;
  private: boolean;
  order: number;
}

export interface RegistryMetadataSnapshot<DecoratorName extends string = string> {
  readonly all: readonly DecorationRecord[];
  readonly classes: readonly DecorationRecord[];
  readonly properties: readonly DecorationRecord[];
  readonly methods: readonly DecorationRecord[];
  readonly accessors: readonly DecorationRecord[];

  firstClass(decorator: DecoratorName): DecorationRecord | undefined;

  classRecords(decorator?: DecoratorName): readonly DecorationRecord[];
  propertyRecords(decorator?: DecoratorName): readonly DecorationRecord[];
  methodRecords(decorator?: DecoratorName): readonly DecorationRecord[];
  accessorRecords(decorator?: DecoratorName): readonly DecorationRecord[];

  propertyMap(decorator?: DecoratorName): ReadonlyMap<string | symbol, readonly DecorationRecord[]>;
  methodMap(decorator?: DecoratorName): ReadonlyMap<string | symbol, readonly DecorationRecord[]>;
  accessorMap(decorator?: DecoratorName): ReadonlyMap<string | symbol, readonly DecorationRecord[]>;
}

export interface CreateDecoratorRegistryOptions {
  namespace?: string;
  allowPrivateMembers?: boolean;
}

export interface RegistryReadOptions {
  includeInherited?: boolean;
}

export type StandardClassDecorator<TExpected, TMetadata> = (
  ...args: MetadataArgs<TMetadata>
) => <TClass extends Constructor<TExpected>>(
  value: TClass,
  context: ClassDecoratorContext<TClass>,
) => void;

export type UnscopedClassDecoratorFactory<TMetadata> = <TExpected = unknown>(
  ...args: MetadataArgs<TMetadata>
) => <TClass extends Constructor<TExpected>>(
  value: TClass,
  context: ClassDecoratorContext<TClass>,
) => void;

export interface PropertyDecoratorFactory<TContract, TTarget, TMetadata> {
  (...args: MetadataArgs<TMetadata>): (
    value: undefined,
    context: ClassFieldDecoratorContext<any, TTarget>,
  ) => void;

  <K extends KeysOfType<TContract, TTarget>>(
    ...args: DirectKeyedMetadataArgs<K, TMetadata>
  ): (
    value: undefined,
    context: ClassFieldDecoratorContext<TContract, TContract[K]> & { name: K },
  ) => void;

  on<K extends KeysOfType<TContract, TTarget>>(
    ...args: KeyedMetadataArgs<K, TMetadata>
  ): (
    value: undefined,
    context: ClassFieldDecoratorContext<TContract, TContract[K]> & { name: K },
  ) => void;
}

export interface MethodDecoratorFactory<
  TContract,
  TTarget extends AnyFunction,
  TMetadata,
> {
  (...args: MetadataArgs<TMetadata>): (
    value: TTarget,
    context: ClassMethodDecoratorContext<any, TTarget>,
  ) => void;

  <K extends MethodKeysOfType<TContract, TTarget>>(
    ...args: DirectKeyedMetadataArgs<K, TMetadata>
  ): (
    value: TContract[K] extends AnyFunction ? TContract[K] : never,
    context: ClassMethodDecoratorContext<
      TContract,
      TContract[K] extends AnyFunction ? TContract[K] : never
    > & { name: K },
  ) => void;

  on<K extends MethodKeysOfType<TContract, TTarget>>(
    ...args: KeyedMetadataArgs<K, TMetadata>
  ): (
    value: TContract[K] extends AnyFunction ? TContract[K] : never,
    context: ClassMethodDecoratorContext<
      TContract,
      TContract[K] extends AnyFunction ? TContract[K] : never
    > & { name: K },
  ) => void;
}

export type GetterDecorator<TContract, TTarget, K extends PublicMemberKey = PublicMemberKey> = (
  value: (this: TContract) => TTarget,
  context: ClassGetterDecoratorContext<TContract, TTarget> & { name: K },
) => void;

export type SetterDecorator<TContract, TTarget, K extends PublicMemberKey = PublicMemberKey> = (
  value: (this: TContract, value: TTarget) => void,
  context: ClassSetterDecoratorContext<TContract, TTarget> & { name: K },
) => void;

export type AutoAccessorDecorator<
  TContract,
  TTarget,
  K extends PublicMemberKey = PublicMemberKey,
> = (
  value: ClassAccessorDecoratorTarget<TContract, TTarget>,
  context: ClassAccessorDecoratorContext<TContract, TTarget> & { name: K },
) => void;

export interface AccessorDecoratorFactory<TContract, TTarget, TMetadata> {
  (...args: MetadataArgs<TMetadata>):
    & GetterDecorator<any, TTarget>
    & SetterDecorator<any, TTarget>
    & AutoAccessorDecorator<any, TTarget>;

  <K extends KeysOfType<TContract, TTarget>>(
    ...args: DirectKeyedMetadataArgs<K, TMetadata>
  ):
    & GetterDecorator<TContract, TContract[K], K>
    & SetterDecorator<TContract, TContract[K], K>
    & AutoAccessorDecorator<TContract, TContract[K], K>;

  on<K extends KeysOfType<TContract, TTarget>>(
    ...args: KeyedMetadataArgs<K, TMetadata>
  ):
    & GetterDecorator<TContract, TContract[K], K>
    & SetterDecorator<TContract, TContract[K], K>
    & AutoAccessorDecorator<TContract, TContract[K], K>;
}

export type ScopedDecoratorBuilder<TSchema extends DecoratorSchema, TContract> = {
  class<K extends StringKeyOf<TSchema['class']>>(
    name: K,
  ): StandardClassDecorator<TContract, MetadataOf<TSchema['class'][K]>>;

  property<K extends StringKeyOf<TSchema['property']>>(
    name: K,
  ): PropertyDecoratorFactory<
    TContract,
    TargetOf<TSchema['property'][K]>,
    MetadataOf<TSchema['property'][K]>
  >;

  method<K extends StringKeyOf<TSchema['method']>>(
    name: K,
  ): MethodDecoratorFactory<
    TContract,
    Extract<TargetOf<TSchema['method'][K]>, AnyFunction>,
    MetadataOf<TSchema['method'][K]>
  >;

  accessor<K extends StringKeyOf<TSchema['accessor']>>(
    name: K,
  ): AccessorDecoratorFactory<
    TContract,
    TargetOf<TSchema['accessor'][K]>,
    MetadataOf<TSchema['accessor'][K]>
  >;
};

export interface DecoratorRegistry<TSchema extends DecoratorSchema> {
  readonly namespace: string;
  readonly allowPrivateMembers: boolean;

  class<K extends StringKeyOf<TSchema['class']>>(
    name: K,
  ): UnscopedClassDecoratorFactory<MetadataOf<TSchema['class'][K]>>;

  for<TContract>(): ScopedDecoratorBuilder<TSchema, TContract>;

  read(target: Constructor | object, options?: RegistryReadOptions): RegistryMetadataSnapshot;
}
