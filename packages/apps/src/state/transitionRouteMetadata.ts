import { toPascalCase } from '@epsilon-asi/foundation';
import { appendTransitionVerb } from '../endpoints/assertRouteNamesAvailable.js';
import { crudPaths, type CrudPathsOptions } from '../endpoints/crudPaths.js';

export interface TransitionRouteMetadataOptions extends CrudPathsOptions {
  /** Transition key declared on the state machine. Used verbatim in the route. */
  verb: string;
}

/** Derives a named POST route for a transition on one resource item. */
export function transitionRouteMetadata<const Options extends TransitionRouteMetadataOptions>(options: Options) {
  const path = appendTransitionVerb({ path: crudPaths(options).item, verb: options.verb });
  const verbName = toPascalCase(options.verb);
  const resourceName: Options['name'] = options.name;
  const name = `${verbName}${resourceName}` as const;
  if (!/^\p{ID_Start}\p{ID_Continue}*$/u.test(name)) {
    throw new TypeError(`Transition "${options.verb}" on "${resourceName}" must produce a valid endpoint name.`);
  }
  return { kind: 'transition', name, method: 'post', path } as const;
}
