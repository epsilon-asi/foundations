import { camelResourceName, pluralResourceName, type CrudEndpointNamesOptions } from './resourceNames.js';

/** Derives the collection field in an offset- or cursor-paged list response. */
export function listResponseKey<const Options extends CrudEndpointNamesOptions>(options: Options) {
  return camelResourceName(pluralResourceName(options), 'a list response key');
}
