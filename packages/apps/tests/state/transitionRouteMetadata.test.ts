import { expect, expectTypeOf, it } from 'vitest';
import { transitionRouteMetadata } from '../../src/state/transitionRouteMetadata.js';

it('derives the name and POST route of ArchiveOffering', () => {
  const route = transitionRouteMetadata({ name: 'Offering', verb: 'archive' });
  expect(route).toEqual({ kind: 'transition', name: 'ArchiveOffering', method: 'post', path: '/offerings/:offeringId/archive' });
  expectTypeOf(route.kind).toEqualTypeOf<'transition'>();
  expectTypeOf(route.method).toEqualTypeOf<'post'>();
});

it('uses parent and plural declarations and the original verb spelling for the path', () => {
  expect(transitionRouteMetadata({
    name: 'Person', plural: 'People', parent: { name: 'Company', plural: 'Companies' }, verb: 'request-review',
  })).toEqual({
    kind: 'transition', name: 'RequestReviewPerson', method: 'post', path: '/companies/:companyId/people/:personId/request-review',
  });
});

it('derives a tenant transition from the singular item path without an ID', () => {
  expect(transitionRouteMetadata({ name: 'SalesAccount', tenancy: 'self', verb: 'requestReview' })).toEqual({
    kind: 'transition', name: 'RequestReviewSalesAccount', method: 'post', path: '/sales-account/requestReview',
  });
});

it.each(['bulk', 'ReStore'])('rejects the reserved transition verb %s', verb => {
  expect(() => transitionRouteMetadata({ name: 'Offering', verb })).toThrow('is reserved');
});

it.each(['', ':id', 'a/b'])('rejects %j as a transition segment', verb => {
  expect(() => transitionRouteMetadata({ name: 'Offering', verb })).toThrow('single static path segment');
});

it.each(['123', 'archive²'])('rejects %j when it would produce an invalid export name', verb => {
  expect(() => transitionRouteMetadata({ name: 'Offering', verb })).toThrow('valid endpoint name');
});
