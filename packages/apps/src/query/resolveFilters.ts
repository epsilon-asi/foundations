import type { Constructor } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';
import { fieldMessageKeys } from '../i18n/fieldMessageKeys.js';
import type { IdAxis, ReadAxis, TenantAxis } from '../model/access.js';
import { crudFieldAccess, isCrudIdField } from '../model/extensions/crud.js';
import { fieldEnumValues } from '../model/fieldEnumValues.js';
import { selectOperationFields } from '../model/selectOperationFields.js';
import type { ReadModel } from '../model/types.js';
import { unwrapFieldSchema } from '../model/unwrapFieldSchema.js';
import { FilterOperator, type FILTER_OPERATORS } from './filterOperators.js';
import { resolveBaseFieldFilter } from './resolveFieldFilter.js';
import type { FilterFieldKind, OperatorsByKind } from './resolveFilterOperators.js';
import type { ResolveSortsOptions } from './resolveSorts.js';

export interface ResolveFiltersOptions {
  /** Each declared field enables its full group or a named subset of its operators. */
  filter?: Readonly<Record<string, true | readonly FilterOperator[]>>;
  /** The resolved resource provides access grants and field schemas for list declarations. */
  model?: Pick<ResolveSortsOptions, 'name' | 'fields' | 'target'>;
}

/** Each enum descriptor exposes its stored values in declaration order. */
export type FilterDescriptor<
  Path extends string = string,
  Kind extends FilterFieldKind = FilterFieldKind,
  Operator extends FilterOperator = FilterOperator,
  Value extends string = string,
> = {
  readonly path: Path;
  readonly labelKey: string;
  readonly operators: readonly Operator[];
} & (Kind extends 'enum' ? { readonly kind: Kind; readonly values: readonly Value[] } : { readonly kind: Kind });

type ResourceField<Model, Path> = Model extends { target: Constructor<infer Instance> }
  ? Path extends keyof Instance ? Instance[Path] : unknown : unknown;
// The immediate read grant is enough. Projecting arrays, references and recursive JSON can expand their contents.
type ReadValue<Field> = ReadAxis extends keyof NonNullable<Field> ? Exclude<NonNullable<Field>[ReadAxis], undefined> : unknown;
/** Stored value of an immediate readable field, including its nullability. */
export type FilterValue<Model, Path, Field = ResourceField<Model, Path>> = ReadValue<Field> | Extract<Field, null>;
type ValueKind<Value> =
  [Value] extends [string] ? string extends Value ? 'text' : 'enum' :
  [Value] extends [number | bigint | Date] ? 'range' :
  [Value] extends [boolean] ? 'boolean' :
  [Value] extends [readonly unknown[]] ? 'array' : never;
type DeclaredKind<Field, Kind = ValueKind<ReadValue<Field>>> =
  [Kind] extends [never] ? never : [NonNullable<Field>] extends [never] ? 'enum' :
  IdAxis extends keyof NonNullable<Field> ? 'id' : Kind;
type RuntimeKind<Kind> = Kind extends 'text' ? 'text' | 'enum' : Kind;
type FieldKind<Field> = unknown extends ReadValue<Field> ? FilterFieldKind : RuntimeKind<DeclaredKind<Field>>;
type AllowedOperators<Kind extends FilterFieldKind, Field> =
  null extends Field ? OperatorsByKind[Kind] | (typeof FILTER_OPERATORS.nullable)[number] : OperatorsByKind[Kind];
type MemberKeys<Field> = Field extends unknown ? keyof Field : never;
type FieldCap<Field, Kind extends FilterFieldKind = DeclaredKind<Field>> =
  TenantAxis extends MemberKeys<NonNullable<Field>> ? never : [Kind] extends [never] ? never :
  true | readonly AllowedOperators<Kind, Field>[];
type ResourceCap<Instance, Path> = unknown extends Instance ? true | readonly FilterOperator[] :
  Path extends keyof Instance & keyof ReadModel<Instance> ? FieldCap<Instance[Path]> : never;

/** Each supplied key is checked, including keys on an options variable passed to a builder. */
export type CheckedFilters<Instance, Path extends string> = {
  filter?: { readonly [Key in Path]?: ResourceCap<NoInfer<Instance>, Key> };
};
type SelectedOperators<Kind extends FilterFieldKind, Field, Cap> =
  Cap extends readonly (infer Operator extends FilterOperator)[] ? Operator : AllowedOperators<Kind, Field>;
// A text schema and a string enum with widened values both produce string. A literal cap can distinguish their groups.
type RequiredOperators<Cap> = Cap extends readonly [FilterOperator, ...FilterOperator[]] ? Cap[number] : never;
type FieldDescriptor<Path extends string, Field, Cap, Kind extends FilterFieldKind = FieldKind<Field>> =
  Kind extends FilterFieldKind
    ? RequiredOperators<Cap> extends AllowedOperators<Kind, Field>
      ? FilterDescriptor<Path, Kind, SelectedOperators<Kind, Field, Cap>, ReadValue<Field> extends string ? ReadValue<Field> : string>
      : never : never;
type FilterMap<Model, Declaration> = {
  readonly [Path in keyof Declaration as Path & string]: FieldDescriptor<Path & string, ResourceField<Model, Path>, Declaration[Path]>;
};
type DeclaredFilters<Model, Declaration, Entries = FilterMap<NonNullable<Model>, NonNullable<Declaration>>> =
  [Model] extends [{ fields: unknown }] ? undefined extends Declaration ? Partial<Entries> :
    string extends keyof Declaration ? Partial<Entries> : Entries : Partial<Entries>;

/** Literal declarations carry their own paths and caps. Metadata-only lookups can be narrowed by kind. */
export type ResolvedFilters<Model = ResolveFiltersOptions['model'], Declaration = ResolveFiltersOptions['filter']> =
  [Model] extends [undefined] ? Readonly<object> :
  'fields' extends keyof NonNullable<Model> ? [Declaration] extends [undefined] ? Readonly<object> :
    DeclaredFilters<Model, Declaration> : Readonly<object>;

const filterCap = z.union([z.literal(true), z.array(z.enum(FilterOperator))]);
const emptyFilters = Object.freeze(Object.create(null) as Record<never, never>);

/** Validates list.filter and resolves frozen descriptors for its declared resource fields. */
export function resolveFilters(): Readonly<object>;
export function resolveFilters<const Options extends ResolveFiltersOptions, Instance = unknown, Path extends string = string>(
  options: Options & { model?: { target?: Constructor<Instance> } } & CheckedFilters<Instance, Path>,
): ResolvedFilters<Options['model'], Options['filter']>;
export function resolveFilters({ filter, model }: ResolveFiltersOptions = {}): Readonly<Record<string, FilterDescriptor>> {
  if (filter === undefined) return emptyFilters;
  if (Object.prototype.toString.call(filter) !== '[object Object]') {
    throw new ApiDefinitionError('A list filter declaration requires an object of field names and operators.');
  }
  const entries = Object.entries(filter);
  if (model === undefined) {
    for (const [path, cap] of entries) {
      if (!filterCap.safeParse(cap).success) {
        throw new ApiDefinitionError(`List filter "${path}" requires true or a list of filter operators.`);
      }
    }
    return emptyFilters;
  }

  const readable = selectOperationFields({ fields: model.fields, operation: 'read' });
  const filters: Record<string, FilterDescriptor> = Object.create(null);
  for (const [path, cap] of entries) {
    const field = readable.get(path);
    if (!field) {
      const reason = model.fields.has(path) ? 'unreadable' : 'undeclared';
      throw new ApiDefinitionError(`Filter on resource "${model.name}" includes the ${reason} field "${path}".`);
    }
    if (crudFieldAccess(field) === 'tenant') {
      throw new ApiDefinitionError(`Filter on resource "${model.name}" includes the Tenant field "${path}". Tenant scope comes from the request context.`);
    }
    try {
      const { schema, nullable } = unwrapFieldSchema(field.schema);
      const { kind, operators } = resolveBaseFieldFilter({ schema, nullable, cap, primaryKey: isCrudIdField(field) });
      const { label } = fieldMessageKeys({ resource: model.name, field: path, ui: field.extensions.ui });
      // The enum filter group only accepts finite string choices. The catalog shares their stored values.
      const group = kind === 'enum' ? { kind, values: fieldEnumValues(schema) as readonly string[] } as const : { kind };
      filters[path] = Object.freeze({ path, ...group, operators, labelKey: label });
    } catch (cause) {
      if (!(cause instanceof ApiDefinitionError)) throw cause;
      throw new ApiDefinitionError(`Invalid filter "${model.name}.${path}". ${cause.message}`, { cause });
    }
  }
  return Object.freeze(filters);
}
