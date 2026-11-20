import { z } from 'zod/v4';
import { reservedQueryFields, type OptionalQueryFields, type QueryFieldName } from './queryFieldNames.js';
import { SortDirection } from './sortDirection.js';

type OrderBy<Sorts> = [QueryFieldName<keyof Sorts>] extends [never]
  ? Record<string, never>
  : OptionalQueryFields<Record<QueryFieldName<keyof Sorts>, SortDirection>>;
const direction = z.enum(SortDirection);

/** The wire and model use the same keys, with the first supplied key taking precedence. */
export function orderBySchema<Sorts extends object>(sorts: Sorts): z.ZodType<OrderBy<Sorts>, OrderBy<Sorts>> {
  const paths = Object.keys(sorts).filter(path => !reservedQueryFields.has(path));
  const entries = z.map(z.enum(paths), direction);
  const schema = z.unknown().check(payload => {
    const input = payload.value;
    if (!z.core.util.isPlainObject(input)) {
      payload.issues.push({ code: 'invalid_type', expected: 'object', input });
      return;
    }
    // Zod records skip an own __proto__ property. A map checks every enumerable key and keeps its order.
    const keys = Reflect.ownKeys(input).filter(key => Object.prototype.propertyIsEnumerable.call(input, key));
    const parsed = entries.safeParse(new Map(keys.map(key => [key, input[key]])));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        payload.issues.push({ code: 'custom', path: issue.path, message: issue.message, input });
      }
      return;
    }
    payload.value = Object.fromEntries(parsed.data);
  }).meta({
    type: 'object',
    propertyNames: { type: 'string', enum: paths },
    additionalProperties: { type: 'string', enum: direction.options },
  });
  // The registry provides the runtime names. ResolvedSorts preserves their literals for typed resources.
  return schema as z.ZodType<OrderBy<Sorts>, OrderBy<Sorts>>;
}
