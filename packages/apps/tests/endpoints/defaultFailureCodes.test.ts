import { expect, expectTypeOf, it } from 'vitest';
import { defaultFailureCodes, type DefaultFailureCode, type DefaultFailureCodesOptions } from '../../src/endpoints/defaultFailureCodes.js';

const cases: [string, DefaultFailureCodesOptions, number[]][] = [
  ['tenant collection read', { path: '/offerings', operation: 'List' }, [400, 401, 403, 404, 422, 429, 500, 503]],
  ['tenant item read', { scope: 'tenant', path: '/offerings/:id', operation: 'Get' }, [400, 401, 403, 404, 422, 429, 500, 503]],
  ['public refresh', { scope: 'public', path: '/refresh' }, [422, 429, 500]],
  ['public item', { scope: 'public', path: '/invites/:token/accept' }, [404, 422, 429, 500]],
  ['account action', { scope: 'account', path: '/sign-out' }, [401, 403, 422, 429, 500, 503]],
  ['account item', { scope: 'account', path: '/devices/:deviceId' }, [401, 403, 404, 422, 429, 500, 503]],
  ['literal colon', { scope: 'public', path: '/ping\\:pong' }, [422, 429, 500]],
  ['named wildcard', { scope: 'public', path: '/assets/*resource' }, [404, 422, 429, 500]],
  ['budget guard', { scope: 'account', path: '/reports', requiresBudget: true }, [401, 402, 403, 422, 429, 500, 503]],
  ['feature rule', { scope: 'account', path: '/reports', requiresFeature: true }, [401, 402, 403, 422, 429, 500, 503]],
  ['both guards', { path: '/reports', requiresBudget: true, requiresFeature: true }, [400, 401, 402, 403, 404, 422, 429, 500, 503]],
];

it.each(cases)('derives the default statuses for %s', (_label, declaration, expected) => {
  const codes = defaultFailureCodes(declaration);
  expect(codes).toEqual(expected);
  expectTypeOf(codes).toEqualTypeOf<DefaultFailureCode[]>();
});

it.each(['Create', 'Update', 'Delete'] as const)('includes a conflict for %s', operation => {
  const codes = defaultFailureCodes({ path: '/offerings', operation });
  expect(codes).toEqual([400, 401, 403, 404, 409, 422, 429, 500, 503]);
  expectTypeOf(codes).toEqualTypeOf<DefaultFailureCode[]>();
  expectTypeOf<DefaultFailureCode>().toEqualTypeOf<400 | 401 | 402 | 403 | 404 | 409 | 422 | 429 | 500 | 503>();
});

it('keeps the guarded and route-dependent failures available for public and account scopes', () => {
  const options = { path: '/invites/:token', operation: 'Delete', requiresFeature: true } as const;
  const publicCodes = defaultFailureCodes({ ...options, scope: 'public' });
  const accountCodes = defaultFailureCodes({ ...options, scope: 'account' });
  expect(publicCodes).toEqual([402, 404, 409, 422, 429, 500]);
  expect(accountCodes).toEqual([401, 402, 403, 404, 409, 422, 429, 500, 503]);
  expectTypeOf(publicCodes).toEqualTypeOf<(402 | 404 | 409 | 422 | 429 | 500)[]>();
  expectTypeOf(accountCodes).toEqualTypeOf<Exclude<DefaultFailureCode, 400>[]>();
});

it('retains all possible statuses for union and optional scope declarations', () => {
  const shared = (scope: 'public' | 'account') => defaultFailureCodes({ path: '/invites', scope });
  expectTypeOf(shared).returns.toEqualTypeOf<DefaultFailureCode<'account'>[]>();
  expect(shared('public')).toEqual([422, 429, 500]);
  expect(shared('account')).toEqual([401, 403, 422, 429, 500, 503]);

  const optional = (options: { scope?: 'public' }) => defaultFailureCodes({ path: '/invites', ...options });
  expectTypeOf(optional).returns.toEqualTypeOf<DefaultFailureCode[]>();
  expect(optional({})).toContain(400);
  expect(optional({ scope: 'public' })).toEqual([422, 429, 500]);
  const maybePublic = (scope: 'public' | undefined) => defaultFailureCodes({ path: '/invites', scope });
  expectTypeOf(maybePublic).returns.toEqualTypeOf<DefaultFailureCode[]>();
  expect(maybePublic(undefined)).toEqual(optional({}));
  expectTypeOf<Parameters<typeof defaultFailureCodes>>().toEqualTypeOf<[options: DefaultFailureCodesOptions]>();
  expectTypeOf<ReturnType<typeof defaultFailureCodes>>().toEqualTypeOf<DefaultFailureCode[]>();
});
