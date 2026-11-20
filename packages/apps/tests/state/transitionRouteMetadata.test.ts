import { expect, expectTypeOf, it } from 'vitest';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { transitionRouteMetadata } from '../../src/state/transitionRouteMetadata.js';
import { DEFAULT_ENDPOINT_PRINCIPALS, type EndpointPrincipalKind } from '../../src/tenancy/endpointPrincipals.js';

it('derives the name and POST route of ArchiveOffering', () => {
  const route = transitionRouteMetadata({ name: 'Offering', verb: 'archive' });
  expect(route).toEqual({ kind: 'transition', name: 'ArchiveOffering', method: 'post', path: '/offerings/:offeringId/archive', docs: true, scope: 'tenant', principals: ['user', 'apiKey'] });
  expectTypeOf(route.kind).toEqualTypeOf<'transition'>();
  expectTypeOf(route.method).toEqualTypeOf<'post'>();
  expectTypeOf(route.principals).toEqualTypeOf<readonly EndpointPrincipalKind[]>();
});

it('uses parent and plural declarations and the original verb spelling for the path', () => {
  expect(transitionRouteMetadata({
    name: 'Person', plural: 'People', parent: { name: 'Company', plural: 'Companies' }, verb: 'request-review',
  })).toEqual({
    kind: 'transition', name: 'RequestReviewPerson', method: 'post', path: '/companies/:companyId/people/:personId/request-review', docs: true, scope: 'tenant', principals: ['user', 'apiKey'],
  });
});

it('derives a tenant transition from the singular item path without an ID', () => {
  expect(transitionRouteMetadata({ name: 'SalesAccount', tenancy: 'self', verb: 'requestReview' })).toEqual({
    kind: 'transition', name: 'RequestReviewSalesAccount', method: 'post', path: '/sales-account/requestReview', docs: true, scope: 'tenant', principals: ['user', 'apiKey'],
  });
});

it('retains hidden transitions and resolves visibility separately for each verb', () => {
  const options = { archive: { scope: 'account', docs: false }, review: { scope: 'public' }, publish: { docs: true } } as const;
  const routes = ['archive', 'review', 'publish'].map(verb => transitionRouteMetadata({ name: 'Offering', verb, options }));
  expect(routes).toMatchObject([
    { name: 'ArchiveOffering', path: '/offerings/:offeringId/archive', docs: false, scope: 'account', principals: ['user'] },
    { name: 'ReviewOffering', path: '/offerings/:offeringId/review', docs: true, scope: 'public' },
    { name: 'PublishOffering', path: '/offerings/:offeringId/publish', docs: true, scope: 'tenant' },
  ]);
});

it('rejects invalid documentation flags only on the selected verb', () => {
  for (const docs of [null, 'false', 0]) {
    const options = { archive: { docs } };
    // @ts-expect-error Runtime callers can supply an invalid visibility.
    expect(() => transitionRouteMetadata({ name: 'Offering', verb: 'archive', options })).toThrow('The docs option on "ArchiveOffering" must be a boolean.');
    // @ts-expect-error The malformed sibling is never selected.
    expect(transitionRouteMetadata({ name: 'Offering', verb: 'review', options }).docs).toBe(true);
  }
});

it('applies a principal declaration to its exact verb and gives siblings their resource defaults', () => {
  const options = { archive: { principals: ['user'] }, publish: { principals: ['apiKey', 'user', 'apiKey'] } } as const;
  const resource = { name: 'Offering', options };
  expect(transitionRouteMetadata({ ...resource, verb: 'archive' }).principals).toEqual(['user']);
  expect(transitionRouteMetadata({ ...resource, verb: 'publish' }).principals).toEqual(['apiKey', 'user']);
  expect(transitionRouteMetadata({ ...resource, verb: 'Archive' }).principals).toBe(DEFAULT_ENDPOINT_PRINCIPALS.tenant);
  expect(transitionRouteMetadata({ ...resource, verb: 'review', tenancy: 'account' }).principals).toBe(DEFAULT_ENDPOINT_PRINCIPALS.account);
});

it('resolves each verb’s own scope before choosing its authenticated principals', () => {
  const options = { archive: { scope: 'account' }, publish: { scope: 'public' }, submit: { scope: 'tenant', principals: ['apiKey'] } } as const;
  const offering = { name: 'Offering', options };
  expect(transitionRouteMetadata({ ...offering, verb: 'archive' })).toMatchObject({ scope: 'account', principals: ['user'] });
  expect(transitionRouteMetadata({ ...offering, verb: 'review' })).toMatchObject({ scope: 'tenant', principals: ['user', 'apiKey'] });
  const account = { ...offering, tenancy: 'account' } as const;
  expect(transitionRouteMetadata({ ...account, verb: 'submit' })).toMatchObject({ scope: 'tenant', principals: ['apiKey'] });
  expect(transitionRouteMetadata({ ...account, verb: 'review' })).toMatchObject({ scope: 'account', principals: ['user'] });
  const published = transitionRouteMetadata({ ...account, verb: 'publish' });
  expect(published.scope).toBe('public');
  expect(published).not.toHaveProperty('principals');
  expect(transitionRouteMetadata({ ...account, verb: 'publish', options: { publish: { scope: 'public', principals: [] } } }).principals).toBeUndefined();
});

it('validates the selected scope and principal restriction together', () => {
  const resource = { name: 'Offering', verb: 'archive' } as const;
  for (const scope of ['platform', null, false]) {
    // @ts-expect-error Runtime callers can supply an invalid scope.
    expect(() => transitionRouteMetadata({ ...resource, options: { archive: { scope } } })).toThrow(/ArchiveOffering.*invalid scope/);
  }
  expect(() => transitionRouteMetadata({ ...resource, options: { archive: { scope: 'public', principals: ['user'] } } })).toThrow(/ArchiveOffering.*public scope/);
  expect(() => transitionRouteMetadata({ ...resource, options: { archive: { scope: 'account', principals: ['apiKey'] } } })).toThrow(/ArchiveOffering.*apiKey/);
  expect(transitionRouteMetadata({ ...resource, options: { review: { scope: 'account', principals: ['apiKey'] } } }).principals.join(','))
    .toBe('user,apiKey');
});

it('ignores inherited option maps, verbs and settings, and distinguishes undefined from an empty restriction', () => {
  const route = { name: 'Offering', verb: 'archive' };
  const declared = { archive: { scope: 'account', principals: ['user'], docs: false } };
  const inheritedMap = Object.assign(Object.create({ options: declared }), route);
  const inherited = transitionRouteMetadata(inheritedMap);
  expect(inherited.docs).toBe(true);
  expect(inherited.principals).toBe(DEFAULT_ENDPOINT_PRINCIPALS.tenant);
  for (const options of [Object.create(declared), { archive: Object.create(declared.archive) }, { archive: { scope: undefined, principals: undefined, docs: undefined } }]) {
    const result = transitionRouteMetadata({ ...route, options });
    expect(result.docs).toBe(true);
    expect(result.scope).toBe('tenant');
    expect(result.principals).toBe(DEFAULT_ENDPOINT_PRINCIPALS.tenant);
  }
  const restricted = transitionRouteMetadata({ ...route, options: { archive: { principals: [] } } });
  expect(restricted.principals).toEqual([]);
  expect(Object.isFrozen(restricted.principals)).toBe(true);
});

it('checks explicit restrictions against the selected transition’s scope and allowed principal kinds', () => {
  const route = { name: 'Offering', verb: 'archive' };
  expect(() => transitionRouteMetadata({ ...route, tenancy: 'account', options: { archive: { principals: ['apiKey'] } } }))
    .toThrow(/ArchiveOffering.*cannot accept principal "apiKey"/);
  expect(() => transitionRouteMetadata({ ...route, options: { archive: { principals: ['agent'] } } })).toThrow(ApiDefinitionError);
  // @ts-expect-error A service is an in-process caller.
  expect(() => transitionRouteMetadata({ ...route, options: { archive: { principals: ['service'] } } })).toThrow(/ArchiveOffering.*unsupported principal kind/);
  // @ts-expect-error A transition's principal list must be an array.
  expect(() => transitionRouteMetadata({ ...route, options: { archive: { principals: 'user' } } })).toThrow(/ArchiveOffering.*must be an array/);
});

it.each(['bulk', 'ReStore'])('rejects the reserved transition verb %s', verb => {
  expect(() => transitionRouteMetadata({ name: 'Offering', verb })).toThrow('is reserved');
});

it.each([
  ['softDelete', true], ['versioned', false], ['deprecated', undefined], ['suspended', false], ['impersonation', undefined],
] as const)('rejects the reserved option %s on the declaration or selected verb', (key, value) => {
  const route = { name: 'Offering', verb: 'archive' };
  const reserved = { [key]: value };
  const error = new TypeError(`Declaration option "${key}" is reserved.`);
  expect(() => transitionRouteMetadata({ ...route, ...reserved })).toThrow(error);
  expect(() => transitionRouteMetadata({ ...route, options: { archive: reserved } })).toThrow(error);
});

it('keeps verb names separate from option names and checks only the selected settings', () => {
  const options = { archive: { docs: false, versioned: false }, suspended: { scope: 'account' } } as const;
  const route = transitionRouteMetadata({ name: 'Offering', verb: 'suspended', options, meta: { deprecated: false } });
  expect(route).toMatchObject({ name: 'SuspendedOffering', path: '/offerings/:offeringId/suspended', scope: 'account' });
  expect(() => transitionRouteMetadata({ name: 'Offering', verb: 'archive', options })).toThrow('Declaration option "versioned" is reserved.');
});

it('ignores inherited reserved settings and catches a non-enumerable own setting', () => {
  const archive = Object.assign(Object.create({ softDelete: false }), { docs: false });
  const options = Object.assign(Object.create({ review: { deprecated: true } }), { archive });
  const route = Object.assign(Object.create({ suspended: true }), { name: 'Offering', verb: 'archive', options });
  expect(transitionRouteMetadata(route).docs).toBe(false);
  expect(transitionRouteMetadata({ ...route, verb: 'review' }).docs).toBe(true);
  Object.defineProperty(archive, 'versioned', { value: undefined });
  expect(() => transitionRouteMetadata(route)).toThrow('Declaration option "versioned" is reserved.');
});

it.each(['', ':id', 'a/b'])('rejects %j as a transition segment', verb => {
  expect(() => transitionRouteMetadata({ name: 'Offering', verb })).toThrow('single static path segment');
});

it.each(['123', 'archive²'])('rejects %j when it would produce an invalid export name', verb => {
  expect(() => transitionRouteMetadata({ name: 'Offering', verb })).toThrow('valid endpoint name');
});
