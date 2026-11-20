import type { listResponseKey } from '../endpoints/listResponseKey.js';
import type { CrudEndpointNamesOptions } from '../endpoints/resourceNames.js';
import type { ReadModel } from '../model/types.js';

// Each possible plural gets its own page. A widened key may also cover a paging field.
export type ListPage<Key extends string, Row, Paging extends object> = Key extends keyof Paging
  ? never
  : Paging & Record<Key, Row[] | Paging[Extract<keyof Paging, Key>]>;

/** Combines one named collection of readable rows with the paging mode's result fields. */
export type ListResponseData<C, Options extends CrudEndpointNamesOptions, Paging extends object> =
  ListPage<ReturnType<typeof listResponseKey<Options>>, ReadModel<C>, Paging>;
