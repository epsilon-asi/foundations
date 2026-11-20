import type { Constructor, ResolvedType } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';
import { booleanWireCodec } from '../wire/boolean.js';
import { dateWireCodec } from '../wire/date.js';
import { numberWireCodec } from '../wire/number.js';
import { ResourceDefinitionError } from './ResourceDefinitionError.js';
import type { ResourceExtensions } from './createResourceSystem.js';
import { selectOperationFields, type FieldOperation } from './selectOperationFields.js';
import type { CreatedFields, CreateInput, ReadModel, UpdateInput } from './types.js';
import { updateFieldSchema, withoutFallbacks } from './updateFieldSchema.js';

/** JSON wire values produced by the supported resource field codecs. */
export type ResourceWire<Value> = Value extends Date | number | boolean ? string :
  Value extends object ? { [Key in keyof Value]: ResourceWire<Value[Key]> } : Value;

export interface ResourceVariants<C extends Constructor> {
  readonly create: z.ZodType<CreatedFields<C>, CreateInput<C>>;
  readonly read: z.ZodType<ReadModel<C>, ReadModel<C>>;
  readonly update: z.ZodType<UpdateInput<C>, UpdateInput<C>>;
  readonly wire: {
    readonly create: z.ZodType<CreatedFields<C>, ResourceWire<CreateInput<C>>>;
    readonly read: z.ZodType<ReadModel<C>, ResourceWire<ReadModel<C>>>;
    readonly update: z.ZodType<UpdateInput<C>, ResourceWire<UpdateInput<C>>>;
  };
}

interface VariantOptions {
  resolve: (target: Constructor) => ResolvedType<unknown, ResourceExtensions>;
  references: WeakMap<() => z.core.$ZodType, () => Constructor>;
}

export function resourceVariants<C extends Constructor>(target: C, { resolve, references }: VariantOptions): ResourceVariants<C> {
  type FieldVariant = (schema: z.core.$ZodType, path: string) => z.core.$ZodType;
  function variant(operation: FieldOperation, decodedField?: FieldVariant) {
    const wire = decodedField !== undefined;
    const resources = new Map<Constructor, z.ZodType>();
    const nodes = new Map<z.core.$ZodType, z.core.$ZodType>();

    function field(schema: z.core.$ZodType, path: string): z.core.$ZodType {
      const cached = nodes.get(schema);
      if (cached) return cached;
      const def = (schema as z.core.$ZodTypes)._zod.def;
      const replace = (changes: Record<string, unknown>) =>
        z.clone(schema, z.core.util.mergeDefs(def, changes), { parent: true });
      // A replacement object or array validates its own contents without injecting defaults into them.
      if (operation === 'update' && (def.type === 'default' || def.type === 'prefault' || def.type === 'catch')) {
        return withoutFallbacks(replace({ innerType: field(def.innerType, path) }));
      }
      const scalar = (codec: z.ZodType) => {
        if (!wire) return schema;
        const composed = codec.pipe(schema as z.ZodType);
        const meta = z.globalRegistry.get(schema);
        return meta ? composed.meta(meta) : composed;
      };
      switch (def.type) {
        case 'date': return scalar(dateWireCodec);
        case 'boolean': return scalar(booleanWireCodec);
        case 'number': return scalar(numberWireCodec);
        case 'null': case 'string': return schema;
        case 'literal':
        case 'enum': {
          const values = def.type === 'literal' ? def.values : z.core.util.getEnumValues(def.entries);
          if (values.every(value => typeof value === 'string' || value === null)) return schema;
          if (values.every(value => typeof value === 'number')) return scalar(numberWireCodec);
          if (values.every(value => typeof value === 'boolean')) return scalar(booleanWireCodec);
          break;
        }
        case 'lazy': {
          const target = references.get(def.getter);
          if (!target) throw new ResourceDefinitionError(`Use this resource system's ref() for a lazy field at "${path}".`);
          let inner: z.core.$ZodType;
          const lazy = replace({ getter: () => inner });
          nodes.set(schema, lazy);
          inner = build(target());
          return lazy;
        }
        case 'array': return replace({ element: field(def.element, path + '[]') });
        case 'optional': case 'nullable': case 'nonoptional': case 'readonly':
          return replace({ innerType: field(def.innerType, path) });
        case 'catch': {
          const innerType = field(def.innerType, path);
          const stored = decodedField ? decodedField(def.innerType, path) : innerType;
          return replace({ innerType, catchValue: (ctx: z.core.$ZodCatchCtx) => z.parse(stored, def.catchValue(ctx)) });
        }
        case 'default': case 'prefault': {
          const innerType = field(def.innerType, path) as z.ZodType;
          const stored = decodedField ? decodedField(def.innerType, path) : innerType;
          // The declared fallback is in stored units (for example a Date). Project
          // object defaults too, or a default nested row can bypass the read grants.
          const fallback = wire
            ? innerType.default(() => z.parse(stored, def.defaultValue))
            : innerType.prefault(() => def.defaultValue);
          const value = z.clone(fallback, z.core.util.mergeDefs(fallback._zod.def, { checks: def.checks }));
          const meta = z.globalRegistry.get(schema);
          return meta ? value.meta(meta) : value;
        }
        case 'union': return replace({ options: def.options.map(option => field(option, path)) });
        case 'object': {
          if (def.catchall && def.catchall._zod.def.type !== 'never') {
            throw new ResourceDefinitionError(`Unsupported open object schema at "${path}".`);
          }
          const shape = Object.fromEntries(Object.entries(def.shape).map(([key, node]) => [key, field(node, path + '.' + key)]));
          return replace({ shape, catchall: operation === 'read' ? undefined : z.never() });
        }
      }
      throw new ResourceDefinitionError(`Unsupported resource schema "${def.type}" at "${path}".`);
    }

    function build(type: Constructor): z.ZodType {
      const cached = resources.get(type);
      if (cached) return cached;
      const model = resolve(type);
      const shape: Record<string, z.core.$ZodType> = Object.create(null);
      const schema = operation === 'read' ? z.object(shape) : z.strictObject(shape);
      resources.set(type, schema);
      for (const [name, entry] of selectOperationFields({ fields: model.fields, operation })) {
        if (wire && entry.extensions.http?.name !== undefined && entry.extensions.http.name !== name) {
          throw new ResourceDefinitionError(`Wire name overrides are not supported on "${model.name}.${name}" yet.`);
        }
        const fieldSchema = field(entry.schema, model.name + '.' + name);
        shape[name] = operation === 'update' ? updateFieldSchema({ schema: fieldSchema }) : fieldSchema;
      }
      return schema;
    }
    return { schema: build(target), field };
  }
  const create = variant('create');
  const read = variant('read');
  const update = variant('update');
  return {
    create: create.schema, read: read.schema, update: update.schema,
    wire: {
      create: variant('create', create.field).schema, read: variant('read', read.field).schema,
      update: variant('update', update.field).schema,
    },
  } as ResourceVariants<C>;
}
