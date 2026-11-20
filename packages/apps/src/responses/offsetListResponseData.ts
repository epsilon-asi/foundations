import type { CrudEndpointNamesOptions } from '../endpoints/resourceNames.js';
import type { ListResponseData } from './listResponseData.js';

/** Offset-paged list data using the resource's collection key and readable row shape. */
export type OffsetListResponseData<C, Options extends CrudEndpointNamesOptions> =
  ListResponseData<C, Options, { count: number }>;
