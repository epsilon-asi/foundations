import { toCamelCase } from '@epsilon-asi/foundation';

export interface CrudEndpointNamesOptions {
  /** Declared singular PascalCase resource name. */
  name: string;
  /** Collection name. Defaults to the singular name followed by s. */
  plural?: string;
}

// An optional override can produce either its declared value or the default.
export type PluralName<Options extends CrudEndpointNamesOptions> =
  Options extends { plural: infer Plural extends string } ? Plural :
  `${Options['name']}s` | ('plural' extends keyof Options ? Exclude<Options['plural'], undefined> : never);

export function pluralResourceName<const Options extends CrudEndpointNamesOptions>(options: Options): PluralName<Options> {
  return (options.plural ?? `${options.name}s`) as PluralName<Options>;
}

export function camelResourceName<Name extends string>(name: Name, purpose: string): Uncapitalize<Name> {
  const resource = toCamelCase(name);
  // The foundation conversion and its TypeScript literal must agree.
  if (resource !== name.charAt(0).toLowerCase() + name.slice(1)) {
    throw new TypeError(`Cannot derive ${purpose} for "${name}". Use a PascalCase resource name with acronyms written as words, such as ApiKey.`);
  }
  return resource as Uncapitalize<Name>;
}
