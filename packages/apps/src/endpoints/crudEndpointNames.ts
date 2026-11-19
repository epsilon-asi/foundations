import { pluralResourceName, type CrudEndpointNamesOptions } from './resourceNames.js';

export type { CrudEndpointNamesOptions } from './resourceNames.js';

/** Derives the five CRUD endpoint export names from the resource declaration. */
export function crudEndpointNames<const Options extends CrudEndpointNamesOptions>(options: Options) {
  const name: Options['name'] = options.name;
  const plural = pluralResourceName(options);
  return {
    Create: `Create${name}`,
    Get: `Get${name}`,
    Update: `Update${name}`,
    Delete: `Delete${name}`,
    List: `List${plural}`,
  } as const;
}
