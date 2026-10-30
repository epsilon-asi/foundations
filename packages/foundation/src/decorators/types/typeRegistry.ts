import { z } from 'zod/v4';
import { createDecoratorRegistry } from '../factory';
import type {
  ClassDecoratorDefinition,
  Constructor,
  DecorationRecord,
  DecoratorSchema,
  PropertyDecoratorDefinition,
} from '../factory';
import { TypeRegistryError } from './errors';
import type {
  AnyFieldDecorator,
  AnyTypeExtension,
  CreateTypeRegistryOptions,
  ExtensionMap,
  ObjectMode,
  PropDecorator,
  ResolvedField,
  ResolvedType,
  TypeClassDecorator,
  TypeDecorator,
  TypeRegistry,
} from './types';

/**
 * Live values (zod schemas, class references, user callbacks) never pass through the factory's
 * immutableClone: deep-freezing a zod schema corrupts zod's shared internals process-wide.
 * Records carry a closure instead, which cloneDeep keeps by reference and deepFreeze cannot see into.
 */
type Handle<T> = () => T;
type Options = Readonly<Record<string, unknown>>;

interface TypePayload {
  readonly options: Options;
}

interface FieldPayload {
  readonly owner: object;
  readonly member: string;
  readonly schema: () => z.ZodType;
  readonly options: Options;
}

interface FieldExtensionPayload {
  readonly owner: object;
  readonly member: string;
  readonly key: string;
  readonly options: unknown;
}

interface TypeExtensionPayload {
  readonly key: string;
  readonly options: unknown;
}

interface TypeRegistrySchema extends DecoratorSchema {
  class: {
    Type: ClassDecoratorDefinition<{ payload: Handle<TypePayload> }>;
    TypeExtension: ClassDecoratorDefinition<{ payload: Handle<TypeExtensionPayload> }>;
  };
  property: {
    Prop: PropertyDecoratorDefinition<{ payload: Handle<FieldPayload> }, unknown>;
    PropExtension: PropertyDecoratorDefinition<{ payload: Handle<FieldExtensionPayload> }, unknown>;
  };
  method: {};
  accessor: {};
}

const FIELD_KEYS = ['description', 'meta'] as const;
const SHORTHAND_KEYS = ['optional', 'min', 'max', 'integer'] as const;
const TYPE_KEYS = ['name', 'description', 'mode', 'meta'] as const;
const RESERVED_KEYS: ReadonlySet<string> = new Set([...FIELD_KEYS, ...SHORTHAND_KEYS, ...TYPE_KEYS]);
const OBJECT_MODES: readonly ObjectMode[] = ['strip', 'strict', 'loose'];

/** Extension-agnostic view of a decorated class. Extension options are still raw here. */
interface FieldModel {
  readonly name: string;
  readonly schema: z.ZodType;
  readonly description?: string;
  readonly meta: Options;
  readonly extensions: ReadonlyMap<string, unknown>;
}

interface TypeModel {
  readonly target: Constructor;
  readonly name: string;
  readonly description?: string;
  readonly mode: ObjectMode;
  readonly meta: Options;
  readonly object: z.ZodObject;
  readonly fields: readonly FieldModel[];
  readonly extensions: ReadonlyMap<string, unknown>;
}

interface Root {
  readonly namespace: string;
  readonly Type: TypeDecorator<any>;
  readonly Prop: PropDecorator<any>;
  ref(target: () => Constructor): z.ZodType;
  model(target: Constructor): TypeModel;
  extensionField(key: string, options: unknown): AnyFieldDecorator;
  extensionType(key: string, options: unknown): TypeClassDecorator;
}

function payloadOf<T>(record: DecorationRecord): T {
  return (record.metadata as { payload: Handle<T> }).payload();
}

function splitOptions(
  options: Options,
  coreKeys: readonly string[],
): { core: Record<string, unknown>; extensions: Map<string, unknown> } {
  const core: Record<string, unknown> = {};
  const extensions = new Map<string, unknown>();

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue;
    if (coreKeys.includes(key)) core[key] = value;
    else extensions.set(key, value);
  }

  return { core, extensions };
}

function mergeExtensionSources(
  inline: Map<string, unknown>,
  standalone: readonly { key: string; options: unknown }[],
  where: string,
  details: { typeName: string; field?: string },
): ReadonlyMap<string, unknown> {
  const merged = new Map(inline);

  for (const { key, options } of standalone) {
    if (merged.has(key)) {
      throw new TypeRegistryError(
        `Extension "${key}" is declared more than once on ${where}. ` +
          'Use either the inline option or the standalone decorator, not both.',
        { ...details, extension: key },
      );
    }
    merged.set(key, options);
  }

  return merged;
}

function withMeta(schema: z.ZodType, description: string | undefined, meta: Options): z.ZodType {
  const combined = description === undefined ? meta : { ...meta, description };
  return Object.keys(combined).length === 0 ? schema : schema.meta(combined);
}

function withOptional(schema: z.ZodType, optional: unknown): z.ZodType {
  return optional === true ? schema.optional() : schema;
}

function objectFactory(mode: ObjectMode) {
  if (mode === 'strict') return z.strictObject;
  if (mode === 'loose') return z.looseObject;
  return z.object;
}

function assertInstanceField(decorator: string, context: ClassFieldDecoratorContext): void {
  // Misuse on methods/accessors is reported by the factory's own kind check.
  if (context.kind !== 'field') return;

  if (context.static) {
    throw new TypeRegistryError(
      `${decorator} cannot be used on static field "${String(context.name)}"; types describe instance data.`,
    );
  }

  if (typeof context.name !== 'string') {
    throw new TypeRegistryError(
      `${decorator} cannot be used on symbol field ${String(context.name)}; object schemas need string keys.`,
    );
  }
}

function createRoot(namespace: string): Root {
  const registry = createDecoratorRegistry<TypeRegistrySchema>({ namespace });
  const scoped = registry.for<Record<string, unknown>>();
  const RawType = registry.class('Type');
  const RawTypeExtension = registry.class('TypeExtension');
  const RawProp = scoped.property('Prop');
  const RawPropExtension = scoped.property('PropExtension');
  const models = new WeakMap<Constructor, TypeModel>();

  function field(schema: () => z.ZodType, options: Options): AnyFieldDecorator {
    return (value, context) => {
      assertInstanceField('@Prop', context);
      const payload: FieldPayload = Object.freeze({
        owner: context.metadata,
        member: context.name as string,
        schema,
        options: Object.freeze({ ...options }),
      });
      (RawProp({ payload: () => payload }) as unknown as AnyFieldDecorator)(value, context);
    };
  }

  function ref(target: () => Constructor): z.ZodType {
    return z.lazy(() => model(target()).object);
  }

  const Prop = ((schema: z.ZodType, options: Options = {}) =>
    field(() => schema, options)) as unknown as PropDecorator<any>;

  Prop.string = ((options: Options = {}) => {
    const { optional, min, max, ...rest } = options;
    let schema = z.string();
    if (typeof min === 'number') schema = schema.min(min);
    if (typeof max === 'number') schema = schema.max(max);
    const built = withOptional(schema, optional);
    return field(() => built, rest);
  }) as PropDecorator<any>['string'];

  Prop.number = ((options: Options = {}) => {
    const { optional, integer, min, max, ...rest } = options;
    let schema = z.number();
    if (integer === true) schema = schema.int();
    if (typeof min === 'number') schema = schema.min(min);
    if (typeof max === 'number') schema = schema.max(max);
    const built = withOptional(schema, optional);
    return field(() => built, rest);
  }) as PropDecorator<any>['number'];

  Prop.boolean = ((options: Options = {}) => {
    const { optional, ...rest } = options;
    const built = withOptional(z.boolean(), optional);
    return field(() => built, rest);
  }) as PropDecorator<any>['boolean'];

  Prop.date = ((options: Options = {}) => {
    const { optional, ...rest } = options;
    const built = withOptional(z.date(), optional);
    return field(() => built, rest);
  }) as PropDecorator<any>['date'];

  Prop.nested = ((target: () => Constructor, options: Options = {}) => {
    const { optional, ...rest } = options;
    const built = withOptional(ref(target), optional);
    return field(() => built, rest);
  }) as PropDecorator<any>['nested'];

  const Type: TypeDecorator<any> = (options = {}) => {
    const payload: TypePayload = Object.freeze({ options: Object.freeze({ ...options }) });
    return RawType({ payload: () => payload });
  };

  function extensionField(key: string, options: unknown): AnyFieldDecorator {
    return (value, context) => {
      assertInstanceField(`Extension "${key}"`, context);
      const payload: FieldExtensionPayload = Object.freeze({
        owner: context.metadata,
        member: context.name as string,
        key,
        options,
      });
      (RawPropExtension({ payload: () => payload }) as unknown as AnyFieldDecorator)(value, context);
    };
  }

  function extensionType(key: string, options: unknown): TypeClassDecorator {
    const payload: TypeExtensionPayload = Object.freeze({ key, options });
    return RawTypeExtension({ payload: () => payload });
  }

  function model(target: Constructor): TypeModel {
    const cached = models.get(target);
    if (cached !== undefined) return cached;

    const built = buildModel(target);
    models.set(target, built);
    return built;
  }

  function buildModel(target: Constructor): TypeModel {
    const all = registry.read(target);
    // Class-level options are not inherited; fields are.
    const own = registry.read(target, { includeInherited: false });

    const ownTypes = own.classRecords('Type');
    if (ownTypes.length > 1) {
      throw new TypeRegistryError(`@Type was applied more than once to ${target.name}.`, {
        typeName: target.name,
      });
    }

    const typeOptions = ownTypes.length === 1 ? payloadOf<TypePayload>(ownTypes[0]).options : {};
    const { core: typeCore, extensions: inlineTypeExtensions } = splitOptions(typeOptions, TYPE_KEYS);
    const name = (typeCore.name as string | undefined) ?? target.name;
    const description = typeCore.description as string | undefined;
    const mode = (typeCore.mode as ObjectMode | undefined) ?? 'strip';
    const meta = Object.freeze({ ...(typeCore.meta as Options | undefined) });

    if (!OBJECT_MODES.includes(mode)) {
      throw new TypeRegistryError(
        `@Type mode for ${name} must be one of ${OBJECT_MODES.join(', ')}, but received "${String(mode)}".`,
        { typeName: name },
      );
    }

    const propRecords = all.propertyRecords('Prop');
    if (propRecords.length === 0 && all.classRecords('Type').length === 0) {
      throw new TypeRegistryError(
        `${name} is not a registered type: it has no @Type or @Prop decorations.`,
        { typeName: name },
      );
    }

    // Owner is the class's decorator metadata object, so "same class" means "same owner".
    const declared = new Map<object, Set<string>>();
    const winners = new Map<string, FieldPayload>();

    for (const record of propRecords) {
      const payload = payloadOf<FieldPayload>(record);
      const members = declared.get(payload.owner) ?? new Set<string>();
      declared.set(payload.owner, members);

      if (members.has(payload.member)) {
        throw new TypeRegistryError(
          `@Prop was applied more than once to field "${payload.member}" (resolving ${name}).`,
          { typeName: name, field: payload.member },
        );
      }

      members.add(payload.member);
      // Records arrive base-first, so a subclass redeclaration replaces the base field
      // while Map keeps the base field's position.
      winners.set(payload.member, payload);
    }

    const standalone = new Map<string, FieldExtensionPayload[]>();
    for (const record of all.propertyRecords('PropExtension')) {
      const payload = payloadOf<FieldExtensionPayload>(record);

      if (declared.get(payload.owner)?.has(payload.member) !== true) {
        throw new TypeRegistryError(
          `Extension "${payload.key}" on field "${payload.member}" must be paired with @Prop ` +
            `in the same class (resolving ${name}).`,
          { typeName: name, field: payload.member, extension: payload.key },
        );
      }

      // Superseded along with the base @Prop it was paired with.
      if (winners.get(payload.member)?.owner !== payload.owner) continue;

      const existing = standalone.get(payload.member) ?? [];
      existing.push(payload);
      standalone.set(payload.member, existing);
    }

    const fields = [...winners.values()].map((payload): FieldModel => {
      const { core, extensions: inline } = splitOptions(payload.options, FIELD_KEYS);
      const fieldDescription = core.description as string | undefined;
      const fieldMeta = Object.freeze({ ...(core.meta as Options | undefined) });

      return Object.freeze({
        name: payload.member,
        schema: withMeta(payload.schema(), fieldDescription, fieldMeta),
        description: fieldDescription,
        meta: fieldMeta,
        extensions: mergeExtensionSources(
          inline,
          standalone.get(payload.member) ?? [],
          `field "${payload.member}" of ${name}`,
          { typeName: name, field: payload.member },
        ),
      });
    });

    const extensions = mergeExtensionSources(
      inlineTypeExtensions,
      own.classRecords('TypeExtension').map((record) => payloadOf<TypeExtensionPayload>(record)),
      name,
      { typeName: name },
    );

    const shape = Object.fromEntries(fields.map((entry) => [entry.name, entry.schema]));
    const object = withMeta(objectFactory(mode)(shape), description, {
      title: name,
      ...meta,
    }) as z.ZodObject;

    return Object.freeze({
      target,
      name,
      description,
      mode,
      meta,
      object,
      fields: Object.freeze(fields),
      extensions,
    });
  }

  return Object.freeze({
    namespace,
    Type,
    Prop,
    ref,
    model,
    extensionField,
    extensionType,
  });
}

function validateExtensionOptions(
  extensions: ReadonlyMap<string, AnyTypeExtension>,
  raw: ReadonlyMap<string, unknown>,
  level: 'field' | 'type',
  where: string,
  details: { typeName: string; field?: string },
): Readonly<Record<string, unknown>> {
  const result: Record<string, unknown> = {};

  for (const [key, options] of raw) {
    const extension = extensions.get(key);
    if (extension === undefined) {
      throw new TypeRegistryError(
        `${where} declares extension "${key}", but this registry has no extension with that key. ` +
          'Register it with .use().',
        { ...details, extension: key },
      );
    }

    const schema = level === 'field' ? extension.field : extension.type;
    if (schema === undefined) {
      throw new TypeRegistryError(
        `Extension "${key}" does not accept ${level}-level options (declared on ${where}).`,
        { ...details, extension: key },
      );
    }

    const parsed = (schema as z.ZodType).safeParse(options);
    if (!parsed.success) {
      throw new TypeRegistryError(
        `Invalid "${key}" options on ${where}:\n${z.prettifyError(parsed.error)}`,
        { ...details, extension: key, cause: parsed.error },
      );
    }

    result[key] = parsed.data;
  }

  return Object.freeze(result);
}

function assertUsableExtension(
  extension: AnyTypeExtension,
  registered: ReadonlyMap<string, AnyTypeExtension>,
): void {
  const key: unknown = extension?.key;

  if (typeof key !== 'string' || key.length === 0) {
    throw new TypeRegistryError('Type extensions need a non-empty string key.');
  }

  if (RESERVED_KEYS.has(key)) {
    throw new TypeRegistryError(
      `Extension key "${key}" is reserved by @Type/@Prop options.`,
      { extension: key },
    );
  }

  if (registered.has(key)) {
    throw new TypeRegistryError(`An extension with key "${key}" is already registered.`, {
      extension: key,
    });
  }

  for (const level of ['field', 'type'] as const) {
    const schema: unknown = extension[level];
    if (schema !== undefined && typeof (schema as z.ZodType).safeParse !== 'function') {
      throw new TypeRegistryError(`Extension "${key}" ${level} options must be a zod schema.`, {
        extension: key,
      });
    }
  }
}

function createFacade<TExt extends ExtensionMap>(
  root: Root,
  registered: ReadonlyMap<string, AnyTypeExtension>,
  extensionDecorators: Readonly<Record<string, object>>,
): TypeRegistry<TExt> {
  const resolved = new WeakMap<Constructor, ResolvedType<unknown, TExt>>();

  function resolve(target: Constructor): ResolvedType<unknown, TExt> {
    const cached = resolved.get(target);
    if (cached !== undefined) return cached;

    const model = root.model(target);
    const fields = new Map<string, ResolvedField<TExt>>();

    for (const entry of model.fields) {
      fields.set(
        entry.name,
        Object.freeze({
          name: entry.name,
          schema: entry.schema,
          description: entry.description,
          meta: entry.meta,
          extensions: validateExtensionOptions(
            registered,
            entry.extensions,
            'field',
            `field "${entry.name}" of ${model.name}`,
            { typeName: model.name, field: entry.name },
          ),
        }) as ResolvedField<TExt>,
      );
    }

    const result = Object.freeze({
      target: model.target,
      name: model.name,
      description: model.description,
      mode: model.mode,
      meta: model.meta,
      object: model.object,
      schema: model.object,
      fields,
      extensions: validateExtensionOptions(registered, model.extensions, 'type', model.name, {
        typeName: model.name,
      }),
      parse: (input: unknown) => model.object.parse(input),
      safeParse: (input: unknown) => model.object.safeParse(input),
      jsonSchema: (params?: z.core.ToJSONSchemaParams) => z.toJSONSchema(model.object, params),
    }) as unknown as ResolvedType<unknown, TExt>;

    resolved.set(target, result);
    return result;
  }

  function use(extension: AnyTypeExtension) {
    assertUsableExtension(extension, registered);

    const field = (options: unknown) => root.extensionField(extension.key, options);
    const type = (options: unknown) => root.extensionType(extension.key, options);
    const custom = extension.decorators?.({ field, type }) ?? {};

    return createFacade(
      root,
      new Map(registered).set(extension.key, extension),
      Object.freeze({
        ...extensionDecorators,
        [extension.key]: Object.freeze({ ...custom, field, type }),
      }),
    );
  }

  return Object.freeze({
    namespace: root.namespace,
    extensions: extensionDecorators,
    Type: root.Type,
    Prop: root.Prop,
    ref: root.ref,
    resolve,
    use,
  }) as unknown as TypeRegistry<TExt>;
}

export function createTypeRegistry(options: CreateTypeRegistryOptions = {}): TypeRegistry {
  return createFacade<{}>(createRoot(options.namespace ?? 'types'), new Map(), Object.freeze({}));
}
