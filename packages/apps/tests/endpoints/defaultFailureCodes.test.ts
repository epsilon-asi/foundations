import { expect, expectTypeOf, it } from 'vitest';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import { defaultFailureCodes, type DefaultFailureCode, type DefaultFailureCodesOptions } from '../../src/endpoints/defaultFailureCodes.js';
import type { EndpointScope } from '../../src/tenancy/endpointScope.js';

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
  expectTypeOf(codes).toEqualTypeOf<DefaultFailureCode<'tenant', typeof operation, false>[]>();
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

it('includes payment failures only when a budget or feature guard can apply', () => {
  const list = { path: '/reports', scope: 'public', operation: 'List' } as const;
  const inactive = defaultFailureCodes({ ...list, requiresBudget: undefined, requiresFeature: false });
  expectTypeOf(inactive).toEqualTypeOf<(422 | 429 | 500)[]>();
  expect(inactive).not.toContain(402);

  for (const flags of [{ requiresBudget: true }, { requiresFeature: true }] as const) {
    const guarded = defaultFailureCodes({ ...list, ...flags });
    expectTypeOf(guarded).toEqualTypeOf<(402 | 422 | 429 | 500)[]>();
    expect(guarded).toContain(402);
  }
  const optional = (flags: { requiresFeature?: boolean; requiresBudget?: false }) => defaultFailureCodes({ ...list, ...flags });
  expectTypeOf(optional).returns.toEqualTypeOf<DefaultFailureCode<'public', 'List', boolean, '/reports'>[]>();
  expect(optional({})).not.toContain(402);
  expect(optional({ requiresFeature: true })).toContain(402);
  const alternatives = (flags: { path: string; requiresBudget: true } | { path: string; requiresFeature?: false }) => defaultFailureCodes(flags);
  expectTypeOf(alternatives).returns.toEqualTypeOf<DefaultFailureCode<'tenant', undefined, boolean>[]>();

  const publicFailures = defaultFailureCodes<'public'>;
  expectTypeOf(publicFailures({ ...list, requiresBudget: true })).toEqualTypeOf<DefaultFailureCode<'public', 'List', true>[]>();
  expectTypeOf(publicFailures({ ...list, operation: 'Create', requiresFeature: true })).toEqualTypeOf<DefaultFailureCode<'public', 'Create', true>[]>();
});

it('retains all possible statuses for union and optional scope declarations', () => {
  const shared = (scope: 'public' | 'account') => defaultFailureCodes({ path: '/invites', scope });
  expectTypeOf(shared).returns.toEqualTypeOf<DefaultFailureCode<'account', undefined, false, '/invites'>[]>();
  expect(shared('public')).toEqual([422, 429, 500]);
  expect(shared('account')).toEqual([401, 403, 422, 429, 500, 503]);

  const optional = (options: { scope?: 'public' }) => defaultFailureCodes({ path: '/invites', ...options });
  expectTypeOf(optional).returns.toEqualTypeOf<DefaultFailureCode<'tenant', undefined, false>[]>();
  expect(optional({})).toContain(400);
  expect(optional({ scope: 'public' })).toEqual([422, 429, 500]);
  const maybePublic = (scope: 'public' | undefined) => defaultFailureCodes({ path: '/invites', scope });
  expectTypeOf(maybePublic).returns.toEqualTypeOf<DefaultFailureCode<'tenant', undefined, false>[]>();
  expect(maybePublic(undefined)).toEqual(optional({}));
  expectTypeOf<Parameters<typeof defaultFailureCodes>>().toEqualTypeOf<[options: DefaultFailureCodesOptions]>();
  expectTypeOf<ReturnType<typeof defaultFailureCodes>>().toEqualTypeOf<DefaultFailureCode[]>();
});

it('derives not-found from the tenant scope or an unescaped route parameter', () => {
  for (const path of ['/reports', '/{preview}', '/literal/\\:name/\\*tail'] as const) {
    const publicCodes = defaultFailureCodes({ scope: 'public', path });
    expectTypeOf(publicCodes).toEqualTypeOf<(422 | 429 | 500)[]>();
    expect(publicCodes).toEqual([422, 429, 500]);
    const accountCodes = defaultFailureCodes({ scope: 'account', path, requiresFeature: true, operation: 'Update' });
    expectTypeOf(accountCodes).toEqualTypeOf<(401 | 402 | 403 | 409 | 422 | 429 | 500 | 503)[]>();
    expect(accountCodes).toEqual([401, 402, 403, 409, 422, 429, 500, 503]);
    const tenantCodes = defaultFailureCodes({ path });
    expectTypeOf(tenantCodes).toEqualTypeOf<(400 | 401 | 403 | 404 | 422 | 429 | 500 | 503)[]>();
    expect(tenantCodes).toContain(404);
  }
  for (const path of ['/reports/:id', '/reports{/:id}', '/assets/*files', '/{*files}', '/:"report-id"', '/literal/\\\\:id'] as const) {
    const publicCodes = defaultFailureCodes({ scope: 'public', path });
    expectTypeOf(publicCodes).toEqualTypeOf<(404 | 422 | 429 | 500)[]>();
    expect(publicCodes).toEqual([404, 422, 429, 500]);
  }
});

it('keeps a possible not-found status for open paths, mixed path choices and an optional tenant scope', () => {
  const pathChoice = (path: '/reports' | '/reports/:id') => defaultFailureCodes({ scope: 'public', path });
  expectTypeOf(pathChoice).returns.toEqualTypeOf<(404 | 422 | 429 | 500)[]>();
  expect(pathChoice('/reports')).not.toContain(404);
  expect(pathChoice('/reports/:id')).toContain(404);
  const widened = (path: string) => defaultFailureCodes({ scope: 'account', path });
  expectTypeOf(widened).returns.toEqualTypeOf<DefaultFailureCode<'account', undefined, false>[]>();
  const open = (path: `/files/${string}/download`) => defaultFailureCodes({ scope: 'public', path });
  expectTypeOf(open).returns.toEqualTypeOf<(404 | 422 | 429 | 500)[]>();
  expect(open('/files/:id/download')).toContain(404);
  expect(open('/files/latest/download')).not.toContain(404);
  const optional = (scope?: 'account') => defaultFailureCodes({ path: '/me', scope });
  expectTypeOf(optional).returns.toEqualTypeOf<DefaultFailureCode<'tenant', undefined, false>[]>();
  expect(optional()).toContain(404);
  expect(optional('account')).not.toContain(404);
});

it('uses the parent of a generated Create path when deriving not-found failures', () => {
  for (const scope of ['public', 'account'] as const) {
    const topLevel = crudRouteMetadata({ name: 'Report', scope }).find(route => route.operation === 'Create')!;
    const collectionCodes = defaultFailureCodes(topLevel);
    expectTypeOf<Extract<(typeof collectionCodes)[number], 404>>().toBeNever();
    expect(collectionCodes).not.toContain(404);

    const nested = crudRouteMetadata({ name: 'Report', scope, parent: { name: 'Catalog' } }).find(route => route.operation === 'Create')!;
    const nestedCodes = defaultFailureCodes(nested);
    expectTypeOf<Extract<(typeof nestedCodes)[number], 404>>().toEqualTypeOf<404>();
    expect(nestedCodes).toContain(404);
  }
  const tenant = crudRouteMetadata({ name: 'Report' }).find(route => route.operation === 'Create')!;
  const tenantCodes = defaultFailureCodes(tenant);
  expectTypeOf<Extract<(typeof tenantCodes)[number], 404>>().toEqualTypeOf<404>();
  expect(tenantCodes).toContain(404);
});

it('reserves the conflict status for operations that can be writes', () => {
  const path = '/reports/:id/notes';
  for (const operation of ['Get', 'List', undefined] as const) {
    const codes = defaultFailureCodes({ path, scope: 'public', operation });
    expect(codes).not.toContain(409);
    expectTypeOf(codes).toEqualTypeOf<(404 | 422 | 429 | 500)[]>();
  }
  const action = defaultFailureCodes({ path });
  expectTypeOf(action).toEqualTypeOf<Exclude<DefaultFailureCode, 402 | 409>[]>();
  expect(action).not.toContain(409);

  const saved = (options: { scope: 'account'; operation?: 'Get' | 'Update' }) => defaultFailureCodes({ path, ...options });
  expectTypeOf(saved).returns.toEqualTypeOf<Exclude<DefaultFailureCode<'account'>, 402>[]>();
  expect(saved({ scope: 'account', operation: 'Update' })).toContain(409);
  expect(saved({ scope: 'account' })).not.toContain(409);
  const reads = (options: { operation?: 'List' | 'Get' }) => defaultFailureCodes({ path, ...options });
  expectTypeOf(reads).returns.toEqualTypeOf<Exclude<DefaultFailureCode, 402 | 409>[]>();

  const union = (options: { path: string; scope: 'public' } | { path: string; scope: 'account'; operation: 'Delete' }) => defaultFailureCodes(options);
  expectTypeOf(union).returns.toEqualTypeOf<Exclude<DefaultFailureCode<'account'>, 402>[]>();
  const indexed = (options: { path: string; scope: 'public' } & Record<string, unknown>) => defaultFailureCodes(options);
  expectTypeOf(indexed).returns.toEqualTypeOf<DefaultFailureCode<'public'>[]>();
  expect(indexed({ path, scope: 'public', operation: 'Create' })).toContain(409);

  const explicitlyScoped = defaultFailureCodes<'public'>({ path, scope: 'public', operation: 'Update' });
  expectTypeOf(explicitlyScoped).toEqualTypeOf<DefaultFailureCode<'public', 'Update', false>[]>();
  const publicFailures = defaultFailureCodes<'public'>;
  expectTypeOf(publicFailures({ path, scope: 'public' })).toEqualTypeOf<DefaultFailureCode<'public', undefined, false>[]>();
  expectTypeOf(publicFailures({ path, scope: 'public', operation: 'Get' })).toEqualTypeOf<DefaultFailureCode<'public', 'Get', false>[]>();
  const maybeWrite = (operation?: 'List' | 'Delete') => publicFailures({ path, scope: 'public', operation });
  expectTypeOf(maybeWrite).returns.toEqualTypeOf<Exclude<DefaultFailureCode<'public'>, 402>[]>();

  function resolve<Scope extends EndpointScope, Operation extends DefaultFailureCodesOptions['operation']>(
    scope: Scope, operation: Operation,
  ): DefaultFailureCode<Scope, Operation, false>[] {
    return defaultFailureCodes({ path, scope, operation });
  }
  expectTypeOf(resolve('public', 'List')).toEqualTypeOf<(404 | 422 | 429 | 500)[]>();
});
