import { expectTypeOf } from 'vitest';
import { defaultFailureCodes, type DefaultFailureCode } from '../../src/endpoints/defaultFailureCodes.js';
import { transitionRouteMetadata, type TransitionRouteMetadata, type TransitionRouteMetadataOptions } from '../../src/state/transitionRouteMetadata.js';
import type { EndpointPrincipalKind } from '../../src/tenancy/endpointPrincipals.js';
import type { EndpointScope } from '../../src/tenancy/endpointScope.js';

const options = { publish: { scope: 'public' }, archive: { scope: 'account', docs: false } } as const;
const resource = { name: 'Offering', options } as const;
const archive = transitionRouteMetadata({ ...resource, verb: 'archive' });
const publish = transitionRouteMetadata({ ...resource, verb: 'publish' });
const review = transitionRouteMetadata({ ...resource, verb: 'review' });
expectTypeOf(archive.scope).toEqualTypeOf<'account'>();
expectTypeOf(archive.docs).toEqualTypeOf<false>();
expectTypeOf(archive.principals.join(',')).toBeString();
expectTypeOf(review.scope).toEqualTypeOf<'tenant'>();
expectTypeOf(review.docs).toEqualTypeOf<true>();
expectTypeOf(review.principals).toEqualTypeOf<readonly EndpointPrincipalKind[]>();
expectTypeOf(publish.scope).toEqualTypeOf<'public'>();
expectTypeOf(publish.docs).toEqualTypeOf<true>();
expectTypeOf(publish.principals).toBeUndefined();
expectTypeOf(defaultFailureCodes(publish)).toEqualTypeOf<DefaultFailureCode<'public', undefined, false>[]>();
expectTypeOf(transitionRouteMetadata({ name: 'User', tenancy: 'account', verb: 'review', options: { review: { scope: undefined } } }).scope).toEqualTypeOf<'account'>();

declare const verb: string;
const dynamicVerb = transitionRouteMetadata({ ...resource, verb });
expectTypeOf(dynamicVerb.scope).toEqualTypeOf<EndpointScope>();
expectTypeOf(dynamicVerb.docs).toEqualTypeOf<boolean>();
expectTypeOf(dynamicVerb.principals).toEqualTypeOf<readonly EndpointPrincipalKind[] | undefined>();
if (dynamicVerb.scope !== 'public') dynamicVerb.principals.join(',');
declare const knownVerb: 'publish' | 'archive';
expectTypeOf(transitionRouteMetadata({ ...resource, verb: knownVerb }).scope).toEqualTypeOf<'public' | 'account'>();
declare const prefix: Record<`re${string}`, { scope: 'public' }>;
declare const suffix: `${string}view`;
expectTypeOf(transitionRouteMetadata({ name: 'Report', verb: suffix, options: prefix }).scope).toEqualTypeOf<'tenant' | 'public'>();

declare const settings: Record<string, { scope: 'public' }> & { publish: { scope: 'public' } };
expectTypeOf(transitionRouteMetadata({ name: 'Item', verb: 'archive', tenancy: 'account', options: settings }).scope).toEqualTypeOf<'account' | 'public'>();
expectTypeOf(transitionRouteMetadata({ name: 'Item', verb: 'publish', options: settings }).principals).toBeUndefined();
declare const optional: { archive?: { scope?: 'public' } } | undefined;
expectTypeOf(transitionRouteMetadata({ name: 'Item', verb: 'archive', options: optional }).scope).toEqualTypeOf<'tenant' | 'public'>();
declare const union: { name: 'User'; verb: 'open'; tenancy: 'account' } | { name: 'Page'; verb: 'publish'; options: typeof options };
expectTypeOf(transitionRouteMetadata(union).scope).toEqualTypeOf<'account' | 'public'>();
expectTypeOf<Extract<TransitionRouteMetadata<typeof union>, { scope: 'public' }>['name']>().toEqualTypeOf<`${string}Page`>();
expectTypeOf<TransitionRouteMetadata['scope']>().toEqualTypeOf<EndpointScope>();
expectTypeOf<TransitionRouteMetadata['docs']>().toEqualTypeOf<boolean>();
declare const optionalDocs: Readonly<Record<string, { docs: false }>>;
expectTypeOf(transitionRouteMetadata({ name: 'Report', verb: 'archive', options: optionalDocs }).docs).toEqualTypeOf<boolean>();
function generic<Options extends TransitionRouteMetadataOptions>(options: Options): TransitionRouteMetadata<Options> {
  return transitionRouteMetadata(options);
}
expectTypeOf(generic({ name: 'User', verb: 'open', tenancy: 'account' }).scope).toEqualTypeOf<'account'>();
expectTypeOf(generic({ name: 'User', verb: 'open' }).docs).toEqualTypeOf<true>();
