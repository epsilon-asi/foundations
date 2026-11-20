import { toPascalCase } from '@epsilon-asi/foundation';
import { assertOptionNamesAvailable } from '../endpoints/assertOptionNamesAvailable.js';
import { appendTransitionVerb } from '../endpoints/assertRouteNamesAvailable.js';
import { crudPaths, type CrudPathsOptions } from '../endpoints/crudPaths.js';
import type { DeclaredOption } from '../endpoints/declaredOption.js';
import { resolveEndpointDocs, type DEFAULT_ENDPOINT_DOCS } from '../endpoints/endpointDocs.js';
import { resolveEndpointPrincipals, type EndpointPrincipalKind, type ResolveEndpointPrincipalsOptions } from '../tenancy/endpointPrincipals.js';
import { defaultEndpointScope, type DeclaredScope, type EndpointScope, type TenancyScopeOf } from '../tenancy/endpointScope.js';

type TransitionSettings = Pick<ResolveEndpointPrincipalsOptions, 'scope' | 'principals'> & {
  /** OpenAPI visibility. Defaults to true. */
  docs?: boolean;
};

export interface TransitionRouteMetadataOptions extends CrudPathsOptions {
  /** Transition key declared on the state machine. Used verbatim in the route. */
  verb: string;
  /** Per-verb settings. Scope defaults to the resource's tenancy, and principals to the effective scope's defaults. */
  options?: Readonly<Record<string, TransitionSettings | undefined>>;
}

// A widened verb can select any compatible named entry, or miss the map entirely.
type VerbSetting<Settings, Verb extends string> = Settings extends object
  ? DeclaredOption<Settings, Verb> | Settings[keyof Settings & Verb] : undefined;
type SelectedSettings<Options extends TransitionRouteMetadataOptions> = VerbSetting<DeclaredOption<Options, 'options'>, Options['verb']>;
type TransitionDocs<Settings, Docs = DeclaredOption<Settings, 'docs'>> =
  Extract<boolean, Docs> | (undefined extends Docs ? typeof DEFAULT_ENDPOINT_DOCS : never);
type ScopeAndPrincipals<Scope extends EndpointScope> = Scope extends 'public'
  ? { readonly scope: Scope; readonly principals?: undefined }
  : { readonly scope: Scope; readonly principals: readonly EndpointPrincipalKind[] };

/** A named transition route with its visibility, scope and authenticated principal kinds. */
export type TransitionRouteMetadata<Options extends TransitionRouteMetadataOptions = TransitionRouteMetadataOptions> =
  Options extends unknown ? {
    readonly kind: 'transition';
    readonly name: `${string}${Options['name']}`;
    readonly method: 'post';
    readonly path: string;
    readonly docs: TransitionDocs<SelectedSettings<Options>>;
  } & ScopeAndPrincipals<DeclaredScope<SelectedSettings<Options>, TenancyScopeOf<Options>>> : never;

/** Derives a named POST route for a transition on one resource item. */
export function transitionRouteMetadata<const Options extends TransitionRouteMetadataOptions>(options: Options): TransitionRouteMetadata<Options>;
export function transitionRouteMetadata(options: TransitionRouteMetadataOptions) {
  assertOptionNamesAvailable(options);
  const path = appendTransitionVerb({ path: crudPaths(options).item, verb: options.verb });
  const verbName = toPascalCase(options.verb);
  const name = `${verbName}${options.name}`;
  if (!/^\p{ID_Start}\p{ID_Continue}*$/u.test(name)) {
    throw new TypeError(`Transition "${options.verb}" on "${options.name}" must produce a valid endpoint name.`);
  }
  const declarations = Object.hasOwn(options, 'options') ? options.options : undefined;
  const settings = declarations && Object.hasOwn(declarations, options.verb) ? declarations[options.verb] : undefined;
  if (settings) assertOptionNamesAvailable(settings);
  const docs = resolveEndpointDocs({ name, settings });
  const declaredScope = settings && Object.hasOwn(settings, 'scope') ? settings.scope : undefined;
  const scope = declaredScope === undefined ? defaultEndpointScope(options) : declaredScope;
  const principals = resolveEndpointPrincipals({
    name, scope,
    principals: settings && Object.hasOwn(settings, 'principals') ? settings.principals : undefined,
  });
  return { kind: 'transition', name, method: 'post', path, docs, scope, ...(principals === undefined ? {} : { principals }) } as const;
}
