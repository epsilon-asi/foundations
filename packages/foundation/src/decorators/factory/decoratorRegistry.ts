import { immutableClone } from './clone';
import { createSnapshot } from './snapshot';
import { symbolMetadata } from './symbolMetadata';
import type {
  AccessorDecoratorFactory,
  AnyFunction,
  Constructor,
  CreateDecoratorRegistryOptions,
  DecorationKind,
  DecorationRecord,
  DecoratorRegistry,
  DecoratorSchema,
  DirectKeyedMetadataArgs,
  MetadataArgs,
  MetadataOf,
  MethodDecoratorFactory,
  PropertyDecoratorFactory,
  PublicMemberKey,
  RegistryMetadataSnapshot,
  RegistryReadOptions,
  ScopedDecoratorBuilder,
  StandardClassDecorator,
  StringKeyOf,
  TargetOf,
  UnscopedClassDecoratorFactory,
} from './types';

type DecoratorMetadataObject = object;

type ClassOrMemberContext =
  | ClassDecoratorContext
  | ClassFieldDecoratorContext
  | ClassMethodDecoratorContext
  | ClassAccessorDecoratorContext
  | ClassGetterDecoratorContext
  | ClassSetterDecoratorContext;

type MemberContext = Exclude<ClassOrMemberContext, ClassDecoratorContext>;

type ParsedDecoratorArgs = {
  readonly key?: PublicMemberKey;
  readonly metadata: unknown;
};

function isPropertyKey(value: unknown): value is PublicMemberKey {
  return typeof value === 'string' || typeof value === 'symbol';
}

function assertPropertyKey(value: unknown, decoratorName: string): PublicMemberKey {
  if (isPropertyKey(value)) return value;
  throw new TypeError(
    `Decorator "${decoratorName}" expected a string or symbol member key, but received ${typeof value}.`,
  );
}

function parseDirectArgs(args: readonly unknown[], decoratorName: string): ParsedDecoratorArgs {
  if (args.length === 0) {
    return { metadata: undefined };
  }

  if (args.length === 1) {
    return { metadata: args[0] };
  }

  return {
    key: assertPropertyKey(args[0], decoratorName),
    metadata: args[1],
  };
}

function parseOnArgs(args: readonly unknown[], decoratorName: string): ParsedDecoratorArgs {
  if (args.length === 0) {
    throw new TypeError(`Decorator "${decoratorName}.on" requires a member key.`);
  }

  return {
    key: assertPropertyKey(args[0], `${decoratorName}.on`),
    metadata: args.length > 1 ? args[1] : undefined,
  };
}

function assertContextKind(
  expectedKind: DecorationKind,
  decoratorName: string,
  context: ClassOrMemberContext,
): void {
  if (expectedKind === 'class' && context.kind === 'class') return;
  if (expectedKind === 'property' && context.kind === 'field') return;
  if (expectedKind === 'method' && context.kind === 'method') return;
  if (
    expectedKind === 'accessor' &&
    (context.kind === 'accessor' || context.kind === 'getter' || context.kind === 'setter')
  ) {
    return;
  }

  throw new TypeError(
    `Decorator "${decoratorName}" can only be used on ${expectedKind} targets, but was used on ${context.kind}.`,
  );
}

function getTargetConstructor(target: Constructor | object): Constructor | undefined {
  if (typeof target === 'function') {
    return target as Constructor;
  }

  const constructor = target.constructor;
  return typeof constructor === 'function' ? (constructor as Constructor) : undefined;
}

function getConstructorChain(constructor: Constructor, includeInherited: boolean): Constructor[] {
  if (!includeInherited) return [constructor];

  const chain: Constructor[] = [];
  let current: unknown = constructor;

  while (typeof current === 'function' && current !== Function.prototype) {
    chain.push(current as Constructor);
    current = Object.getPrototypeOf(current);
  }

  return chain.reverse();
}

function getOwnMetadataObject(constructor: Constructor): DecoratorMetadataObject | undefined {
  if (!Object.prototype.hasOwnProperty.call(constructor, symbolMetadata)) {
    return undefined;
  }

  const metadata = (constructor as unknown as Record<PropertyKey, unknown>)[symbolMetadata];
  return typeof metadata === 'object' && metadata !== null ? metadata : undefined;
}

function samePropertyKey(left: PublicMemberKey, right: PublicMemberKey): boolean {
  return left === right;
}

class ModernDecoratorRegistry<TSchema extends DecoratorSchema>
  implements DecoratorRegistry<TSchema>
{
  public readonly namespace: string;
  public readonly allowPrivateMembers: boolean;

  private nextOrder = 0;
  private readonly recordsByMetadata = new WeakMap<DecoratorMetadataObject, DecorationRecord[]>();

  public constructor(options: CreateDecoratorRegistryOptions = {}) {
    this.namespace = options.namespace ?? 'default';
    this.allowPrivateMembers = options.allowPrivateMembers ?? false;
  }

  public class<K extends StringKeyOf<TSchema['class']>>(
    name: K,
  ): UnscopedClassDecoratorFactory<MetadataOf<TSchema['class'][K]>> {
    return this.createClassFactory(String(name));
  }

  public for<TContract>(): ScopedDecoratorBuilder<TSchema, TContract> {
    return Object.freeze({
      class: <K extends StringKeyOf<TSchema['class']>>(name: K) =>
        this.createScopedClassFactory<TContract, MetadataOf<TSchema['class'][K]>>(String(name)),

      property: <K extends StringKeyOf<TSchema['property']>>(name: K) =>
        this.createPropertyFactory<
          TContract,
          TargetOf<TSchema['property'][K]>,
          MetadataOf<TSchema['property'][K]>
        >(String(name)),

      method: <K extends StringKeyOf<TSchema['method']>>(name: K) =>
        this.createMethodFactory<
          TContract,
          Extract<TargetOf<TSchema['method'][K]>, AnyFunction>,
          MetadataOf<TSchema['method'][K]>
        >(String(name)),

      accessor: <K extends StringKeyOf<TSchema['accessor']>>(name: K) =>
        this.createAccessorFactory<
          TContract,
          TargetOf<TSchema['accessor'][K]>,
          MetadataOf<TSchema['accessor'][K]>
        >(String(name)),
    });
  }

  public read(
    target: Constructor | object,
    options: RegistryReadOptions = {},
  ): RegistryMetadataSnapshot {
    const constructor = getTargetConstructor(target);
    if (constructor === undefined) {
      return createSnapshot([]);
    }

    const includeInherited = options.includeInherited ?? true;
    const constructors = getConstructorChain(constructor, includeInherited);
    const records: DecorationRecord[] = [];

    for (const current of constructors) {
      const metadata = getOwnMetadataObject(current);
      if (metadata === undefined) continue;

      const ownRecords = this.recordsByMetadata.get(metadata);
      if (ownRecords !== undefined) records.push(...ownRecords);
    }

    return createSnapshot(records);
  }

  private createClassFactory<TMetadata>(
    decoratorName: string,
  ): UnscopedClassDecoratorFactory<TMetadata> {
    const factory = (<TExpected = unknown>(...args: MetadataArgs<TMetadata>) => {
      const metadata = args.length === 0 ? undefined : args[0];

      return <TClass extends Constructor<TExpected>>(
        _value: TClass,
        context: ClassDecoratorContext<TClass>,
      ): void => {
        assertContextKind('class', decoratorName, context);
        this.register(context.metadata, {
          kind: 'class',
          decorator: decoratorName,
          metadata,
          static: false,
          private: false,
        });
      };
    }) as UnscopedClassDecoratorFactory<TMetadata>;

    return factory;
  }

  private createScopedClassFactory<TContract, TMetadata>(
    decoratorName: string,
  ): StandardClassDecorator<TContract, TMetadata> {
    return ((...args: MetadataArgs<TMetadata>) => {
      const metadata = args.length === 0 ? undefined : args[0];

      return <TClass extends Constructor<TContract>>(
        _value: TClass,
        context: ClassDecoratorContext<TClass>,
      ): void => {
        assertContextKind('class', decoratorName, context);
        this.register(context.metadata, {
          kind: 'class',
          decorator: decoratorName,
          metadata,
          static: false,
          private: false,
        });
      };
    }) as StandardClassDecorator<TContract, TMetadata>;
  }

  private createPropertyFactory<TContract, TTarget, TMetadata>(
    decoratorName: string,
  ): PropertyDecoratorFactory<TContract, TTarget, TMetadata> {
    const factory = ((...args: unknown[]) => {
      const parsed = parseDirectArgs(args, decoratorName);
      return this.createMemberDecorator('property', decoratorName, parsed);
    }) as unknown as PropertyDecoratorFactory<TContract, TTarget, TMetadata>;

    factory.on = ((...args: unknown[]) => {
      const parsed = parseOnArgs(args, decoratorName);
      return this.createMemberDecorator('property', decoratorName, parsed);
    }) as PropertyDecoratorFactory<TContract, TTarget, TMetadata>['on'];

    return factory;
  }

  private createMethodFactory<TContract, TTarget extends AnyFunction, TMetadata>(
    decoratorName: string,
  ): MethodDecoratorFactory<TContract, TTarget, TMetadata> {
    const factory = ((...args: unknown[]) => {
      const parsed = parseDirectArgs(args, decoratorName);
      return this.createMemberDecorator('method', decoratorName, parsed);
    }) as unknown as MethodDecoratorFactory<TContract, TTarget, TMetadata>;

    factory.on = ((...args: unknown[]) => {
      const parsed = parseOnArgs(args, decoratorName);
      return this.createMemberDecorator('method', decoratorName, parsed);
    }) as MethodDecoratorFactory<TContract, TTarget, TMetadata>['on'];

    return factory;
  }

  private createAccessorFactory<TContract, TTarget, TMetadata>(
    decoratorName: string,
  ): AccessorDecoratorFactory<TContract, TTarget, TMetadata> {
    const factory = ((...args: unknown[]) => {
      const parsed = parseDirectArgs(args, decoratorName);
      return this.createMemberDecorator('accessor', decoratorName, parsed);
    }) as unknown as AccessorDecoratorFactory<TContract, TTarget, TMetadata>;

    factory.on = ((...args: unknown[]) => {
      const parsed = parseOnArgs(args, decoratorName);
      return this.createMemberDecorator('accessor', decoratorName, parsed);
    }) as AccessorDecoratorFactory<TContract, TTarget, TMetadata>['on'];

    return factory;
  }

  private createMemberDecorator(
    kind: Exclude<DecorationKind, 'class'>,
    decoratorName: string,
    parsed: ParsedDecoratorArgs,
  ) {
    return (_value: unknown, context: MemberContext): void => {
      assertContextKind(kind, decoratorName, context);

      if (context.private && !this.allowPrivateMembers) {
        throw new Error(
          `Decorator "${decoratorName}" cannot be used on private member "${String(
            context.name,
          )}" unless allowPrivateMembers is true.`,
        );
      }

      if (parsed.key !== undefined && !samePropertyKey(parsed.key, context.name)) {
        throw new Error(
          `Decorator "${decoratorName}" was keyed for "${String(
            parsed.key,
          )}" but applied to "${String(context.name)}".`,
        );
      }

      this.register(context.metadata, {
        kind,
        decorator: decoratorName,
        metadata: parsed.metadata,
        memberName: context.name,
        static: context.static,
        private: context.private,
      });
    };
  }

  private register(
    metadataObject: DecoratorMetadataObject,
    record: Omit<DecorationRecord, 'id' | 'order'>,
  ): void {
    const order = this.nextOrder;
    this.nextOrder += 1;

    const immutableRecord = Object.freeze({
      ...record,
      id: `${this.namespace}:${record.kind}:${record.decorator}:${order}`,
      order,
      metadata: immutableClone(record.metadata),
    }) as DecorationRecord;

    const existing = this.recordsByMetadata.get(metadataObject);
    if (existing === undefined) {
      this.recordsByMetadata.set(metadataObject, [immutableRecord]);
    } else {
      existing.push(immutableRecord);
    }
  }
}

export function createDecoratorRegistry<TSchema extends DecoratorSchema>(
  options: CreateDecoratorRegistryOptions = {},
): DecoratorRegistry<TSchema> {
  return new ModernDecoratorRegistry<TSchema>(options);
}
