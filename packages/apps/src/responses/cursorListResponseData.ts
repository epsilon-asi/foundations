import type { CrudEndpointNamesOptions } from '../endpoints/resourceNames.js';
import type { ListResponseData } from './listResponseData.js';
import type { ListPagingFields } from './listResponseDataSchema.js';

/** Cursor-paged readable rows. The next cursor is opaque and becomes null at the end of the list. */
export type CursorListResponseData<C, Options extends CrudEndpointNamesOptions> =
  ListResponseData<C, Options, ListPagingFields<'cursor'>>;
