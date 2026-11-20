import { z } from 'zod/v4';
import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';
import { listResponseKey } from '../endpoints/listResponseKey.js';
import type { CrudEndpointNamesOptions } from '../endpoints/resourceNames.js';
import { resolveListPaging, type DeclaredListPaging, type ListPaging, type ListQuerySchemaOptions } from '../query/listQuerySchema.js';
import type { ListPage } from './listResponseData.js';

export interface ListResponseDataSchemaOptions<Row extends z.core.$ZodType = z.core.$ZodType>
  extends CrudEndpointNamesOptions, Pick<ListQuerySchemaOptions, 'paging'> {
  /** The resource's readable row schema, including its wire codecs. */
  row: Row;
}

const pagingFields = {
  offset: z.strictObject({ count: z.int().nonnegative() }),
  cursor: z.strictObject({ nextCursor: z.string().nullable() }),
};

export type ListPagingFields<Paging extends ListPaging> = z.output<(typeof pagingFields)[Paging]>;

// A declaration with more than one possible paging mode describes a union of complete pages.
type PageFor<Key extends string, Row, Paging> = Paging extends ListPaging ? ListPage<Key, Row, ListPagingFields<Paging>> : never;
type PageData<Options extends ListResponseDataSchemaOptions, Direction extends 'input' | 'output'> = Options extends unknown ? PageFor<
  ReturnType<typeof listResponseKey<Options>>,
  Direction extends 'input' ? z.input<Options['row']> : z.output<Options['row']>,
  DeclaredListPaging<Options>
> : never;

/** A bidirectional List payload with its named collection and the selected paging fields. */
export type ListResponseDataSchema<Options extends ListResponseDataSchemaOptions = ListResponseDataSchemaOptions> =
  z.ZodType<PageData<Options, 'output'>, PageData<Options, 'input'>>;

/** Builds the strict success payload for an offset or cursor List. */
export function listResponseDataSchema<const Options extends ListResponseDataSchemaOptions>(options: Options): ListResponseDataSchema<Options>;
export function listResponseDataSchema(options: ListResponseDataSchemaOptions): z.ZodType {
  const key = listResponseKey(options);
  const paging = resolveListPaging(options);
  const fields = pagingFields[paging];
  if (Object.hasOwn(fields.shape, key)) {
    throw new ApiDefinitionError(`List response for "${options.name}" uses "${key}" for both its collection and its ${paging} paging field.`);
  }
  if (!(options.row instanceof z.core.$ZodType)) throw new ApiDefinitionError(`List response for "${options.name}" requires a row schema.`);
  return fields.extend({ [key]: z.array(options.row) });
}
