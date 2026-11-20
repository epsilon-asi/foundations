import { typeObjectFields, type TypeObjectField } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';
import { crudExtension } from '../model/extensions/crud.js';
import { fieldOperations } from '../model/selectOperationFields.js';
import { withoutFallbacks } from '../model/updateFieldSchema.js';
import { unwrapFieldSchema } from '../model/unwrapFieldSchema.js';
import { booleanWireCodec } from '../wire/boolean.js';
import { numberWireCodec } from '../wire/number.js';
import { equalityOperand } from './equalityOperand.js';
import { reservedQueryFields } from './queryFieldNames.js';

/** The bracket object can contain nested objects inside an array operand. */
export function ownArrayValues(input: unknown[], payload: z.core.ParsePayload, operator: string) {
  const ancestors = new Set<object>();
  function copy(value: unknown, path: PropertyKey[]): unknown {
    if (!Array.isArray(value) && !z.core.util.isPlainObject(value)) return value;
    if (ancestors.has(value)) {
      payload.issues.push({ code: 'custom', input: value, path, message: 'A query operand cannot contain a circular value.' });
      return;
    }
    ancestors.add(value);
    const result: Record<PropertyKey, unknown> | unknown[] = Array.isArray(value) ? new Array(value.length) : Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (!Object.prototype.propertyIsEnumerable.call(value, key)) continue;
      if (typeof key !== 'string' || reservedQueryFields.has(key)) {
        payload.issues.push({ code: 'custom', input: value, path: [...path, key], message: `Unrecognized query key "${String(key)}".` });
        continue;
      }
      if (Array.isArray(value) && Array.isArray(result)) {
        const index = Number(key);
        if (!Number.isInteger(index) || String(index) !== key || index < 0 || index >= value.length) {
          payload.issues.push({ code: 'custom', input: value, path: [...path, key], message: 'Expected an array index.' });
        } else result[index] = copy(value[index], [...path, index]);
      } else {
        (result as Record<string, unknown>)[key] = copy((value as Record<string, unknown>)[key], [...path, key]);
      }
    }
    ancestors.delete(value);
    return result;
  }
  return copy(input, [operator]);
}

function readable(field: TypeObjectField) {
  const access = crudExtension.field!.safeParse(field.extensions.crud);
  return access.success && fieldOperations({ extensions: { crud: access.data } }).includes('read');
}

function replace(schema: z.core.$ZodType, changes: Record<string, unknown>): z.ZodType {
  const def = schema._zod.def;
  // An evaluated lazy may cache its original target on the definition. The replacement must resolve its own target.
  const source = def.type === 'lazy' ? { type: def.type, checks: def.checks, error: def.error } : def;
  const result = z.clone(schema, z.core.util.mergeDefs(source, changes));
  const meta = z.globalRegistry.get(schema);
  if (meta) {
    // A schema ID identifies the original declaration. Metadata on a derived node follows Zod's clone rules.
    const { id, ...inherited } = meta;
    z.globalRegistry.add(result, inherited);
  }
  return result as z.ZodType;
}

// Literal unions keep declaration order when two stored values share a wire spelling.
function choices(values: readonly z.core.util.Literal[], schema: z.ZodType): z.ZodType {
  const branches: z.ZodType[] = [];
  for (const kind of new Set(values.map(value => typeof value))) {
    let wire: z.ZodType;
    if (kind === 'number') wire = numberWireCodec;
    else if (kind === 'boolean') wire = booleanWireCodec;
    else if (kind === 'bigint') wire = equalityOperand(z.bigint())!;
    else wire = z.literal(values.filter(value => typeof value === kind));
    branches.push(wire.pipe(schema));
  }
  return branches.length === 1 ? branches[0] : z.union(branches);
}

/** Array comparisons validate the supplied elements independently of constraints on the stored collection. */
export function arrayOperand({ schema, path }: { schema: z.ZodType; path: string }): z.ZodType {
  const array = unwrapFieldSchema(schema).schema._zod.def;
  if (array.type !== 'array') throw new ApiDefinitionError(`Expected an array for filter "${path}".`);
  const cache = new Map<z.core.$ZodType | (() => z.core.$ZodType), z.ZodType>();

  function visit(field: z.core.$ZodType): z.ZodType {
    const def = (field as z.core.$ZodTypes)._zod.def;
    const key = def.type === 'lazy' ? def.getter : field;
    const cached = cache.get(key);
    if (cached) return cached;
    // Recursive object getters and registry refs can point back to a node still under construction.
    cache.set(key, z.lazy(() => cache.get(key)!));
    const result = derive(field, def);
    cache.set(key, result);
    return result;
  }

  function derive(field: z.core.$ZodType, def: z.core.$ZodTypes['_zod']['def']): z.ZodType {
    const declared = field as z.ZodType;
    switch (def.type) {
      case 'lazy': return replace(field, { getter: () => visit((field as z.core.$ZodLazy)._zod.innerType) });
      case 'array': return replace(field, { element: visit(def.element) });
      case 'tuple': return replace(field, { items: def.items.map(visit), rest: def.rest && visit(def.rest) });
      case 'object': {
        const resource = typeObjectFields(field);
        const entries: [string, z.core.$ZodType][] = resource
          ? resource.filter(readable).map(child => [child.name, child.schema])
          : Object.entries(def.shape);
        const shape = Object.fromEntries(entries.filter(([key]) => !reservedQueryFields.has(key)).map(([key, child]) => [key, visit(child)]));
        return replace(field, { shape, catchall: resource ? z.never() : def.catchall && visit(def.catchall) });
      }
      case 'record': return replace(field, { valueType: visit(def.valueType) });
      case 'union': return replace(field, { options: def.options.map(visit) });
      case 'intersection': return replace(field, { left: visit(def.left), right: visit(def.right) });
      case 'optional': case 'nonoptional': case 'nullable': case 'readonly':
      case 'default': case 'prefault': case 'catch':
        return replace(field, { innerType: visit(def.innerType) });
      case 'literal': case 'enum': {
        const values = def.type === 'enum' ? z.core.util.getEnumValues(def.entries) : def.values;
        return values.every(value => typeof value === 'string') ? declared : choices(values, declared);
      }
      case 'pipe': {
        // A structured codec may read a completely different shape. The List compares the stored projection.
        return equalityOperand(declared) ?? visit(withoutFallbacks(declared, 'output'));
      }
      case 'string': case 'number': case 'boolean': case 'date': case 'bigint': return equalityOperand(declared)!;
      case 'null': case 'undefined': case 'never': case 'any': case 'unknown': case 'template_literal': return declared;
      default: throw new ApiDefinitionError(`Unsupported ${def.type} element in array filter "${path}".`);
    }
  }

  return z.array(visit(withoutFallbacks(array.element)));
}
