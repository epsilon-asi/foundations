import type { Constructor, ResolvedField } from '@epsilon-asi/foundation';
import type { z } from 'zod/v4';
import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';
import { fieldMessageKeys } from '../i18n/fieldMessageKeys.js';
import type { crudExtension } from '../model/extensions/crud.js';
import type { uiExtension } from '../model/extensions/ui.js';
import { selectOperationFields } from '../model/selectOperationFields.js';
import type { ReadModel } from '../model/types.js';
import { unwrapFieldSchema } from '../model/unwrapFieldSchema.js';

type SortDeclaration = true | readonly string[];

export interface ResolveSortsOptions {
  /** Declared name used for default field labels. */
  name: string;
  /** Resolved fields, including inherited declarations. */
  fields: ReadonlyMap<string, ResolvedField<{ crud: typeof crudExtension; ui: typeof uiExtension }>>;
  /** The resolved resource class supplies field names for the descriptor type. */
  target?: Constructor;
  /** Immediate readable scalar fields to expose. Default: all of them. */
  sort?: SortDeclaration;
}

export interface SortDescriptor<Path extends string = string> {
  readonly path: Path;
  readonly labelKey: string;
}

type Scalar = string | number | bigint | boolean | Date | null | undefined;
type ScalarPaths<Instance> = {
  [Key in keyof Instance]-?: Instance[Key] extends Scalar ? Key : never;
}[keyof Instance] & string;
// Only read grants and top-level values matter here. Projecting JSON or reference contents can recurse.
type ReadableScalarPaths<Instance> = ScalarPaths<Instance> & keyof ReadModel<Instance>;
type SortPaths<Model> = Model extends { target: Constructor<infer Instance> }
  ? unknown extends Instance ? string : ReadableScalarPaths<Instance>
  : Model extends { fields: ReadonlyMap<infer Key extends string, unknown> } ? Key : string;

/** Infers the instance and field names already carried by a registry result. */
export interface SortSource<Instance, Name extends string> {
  target?: Constructor<Instance>;
  fields?: ReadonlyMap<Name, unknown>;
}
export type CheckedSort<Instance, Name extends string> = {
  sort?: true | readonly NoInfer<unknown extends Instance ? Name : ReadableScalarPaths<Instance> & Name>[];
};

type SelectionOf<Declaration> = Declaration extends { sort: infer Selection } ? Selection : true;

/** The descriptor keys are limited by the declaration and the resource's readable scalars. */
export type ResolvedSorts<Model = ResolveSortsOptions, Selection = SelectionOf<Model>> = {
  readonly [Path in SortPaths<Model> & (Selection extends readonly string[] ? Selection[number] : string)]?: SortDescriptor<Path>;
};

function isSortableScalar(schema: z.core.$ZodType): boolean {
  const def = unwrapFieldSchema(schema).schema._zod.def;
  switch (def.type) {
    case 'string': case 'template_literal': case 'number': case 'nan': case 'bigint':
    case 'boolean': case 'date': case 'enum': case 'literal': case 'null': case 'undefined': case 'success':
      return true;
    case 'union':
      return def.options.length > 0 && def.options.every(isSortableScalar);
    case 'intersection':
      return isSortableScalar(def.left) && isSortableScalar(def.right);
    default:
      // Resource references and z.json() are lazy. Sorting the resource's own fields never follows them.
      return false;
  }
}

function assertSortDeclaration(sort: unknown): asserts sort is SortDeclaration {
  if (sort !== true && (!Array.isArray(sort) || !Array.from(sort).every(path => typeof path === 'string'))) {
    throw new ApiDefinitionError('A list sort declaration requires true or an array of field names.');
  }
}

/** Resolves the selected immediate readable scalar fields in their declared order. */
export function resolveSorts<const Model extends ResolveSortsOptions, Instance = unknown, Name extends string = string>(
  model: Model & SortSource<Instance, Name> & CheckedSort<Instance, Name>,
): ResolvedSorts<Model>;
export function resolveSorts({ name, fields, sort = true }: ResolveSortsOptions): ResolvedSorts {
  assertSortDeclaration(sort);
  const readable = selectOperationFields({ fields, operation: 'read' });
  const sorts: Record<string, SortDescriptor> = Object.create(null);
  for (const path of sort === true ? readable.keys() : sort) {
    const field = readable.get(path);
    if (!field || !isSortableScalar(field.schema)) {
      if (sort === true) continue;
      const reason = !fields.has(path) ? 'undeclared' : field ? 'non-scalar' : 'unreadable';
      throw new ApiDefinitionError(`Sort on resource "${name}" includes the ${reason} field "${path}".`);
    }
    const { label } = fieldMessageKeys({ resource: name, field: path, ui: field.extensions.ui });
    sorts[path] = Object.freeze({ path, labelKey: label });
  }
  return Object.freeze(sorts);
}

/** Resolves an endpoint's sort declaration when model metadata is available. */
export function declaredSorts({ model, sort }: { model?: ResolveSortsOptions; sort?: SortDeclaration }) {
  if (sort === undefined) return;
  if (model) return resolveSorts({ ...model, sort });
  assertSortDeclaration(sort);
}
