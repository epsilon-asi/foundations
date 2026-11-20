import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import type { CreateEndpointsOptions } from '../../src/endpoints/createEndpoints.js';
import type { RequestOf, ResponseTypeUnionOf } from '../../src/endpoints/endpointTypes.js';
import type { DefaultFailureCode } from '../../src/endpoints/defaultFailureCodes.js';
import type { Defaulted, Editable, Id, Readable } from '../../src/model/access.js';
import { createResourceSystem } from '../../src/model/createResourceSystem.js';

const { Resource, Prop, endpoints } = createResourceSystem({ roles: ['READER', 'EDITOR'] });
@Resource()
class Booking {
  @Prop.uuid({ crud: 'id' }) id!: Id<string>;
  @Prop(z.date(), { crud: 'editable' }) startsAt!: Editable<Date>;
  @Prop(z.array(z.string()).default([]), { crud: 'editable' }) tags!: Defaulted<Editable<string[]>>;
  @Prop.string({ crud: 'readable' }) confirmation!: Readable<string>;
  @Prop.string() internalMemo!: string;
}

const operations = { Get: false, Update: false, Delete: false, List: false } as const;
const { CreateBooking } = endpoints(Booking, { name: 'Booking', operations });

it('assembles the literal named CRUD contract and resolves the default and explicit access rules', () => {
  expect(CreateBooking).toMatchObject({
    Name: 'CreateBooking', Method: 'post', Kind: 'crud', Path: '/bookings', Access: 'EDITOR',
    Route: { operation: 'Create', path: '/bookings', code: 201, scope: 'tenant' },
  });
  expectTypeOf(CreateBooking.Name).toEqualTypeOf<'CreateBooking'>();
  const { CreateBooking: override } = endpoints(Booking, {
    name: 'Booking', operations, access: { write: 'EDITOR', create: 'READER' },
  });
  expect(override.Access).toBe('READER');
  expect(override.Route.Access).toBe('READER');
  expectTypeOf(override.Access).toEqualTypeOf<'READER'>();
});

it('preserves a known public or account scope through the generated response contract', () => {
  const pub = endpoints(Booking, { name: 'Booking', operations, scope: 'public' }).CreateBooking;
  const account = endpoints(Booking, {
    name: 'Booking', scope: 'public', operations: { ...operations, Create: { scope: 'account' } },
  }).CreateBooking;
  const publicOverride = endpoints(Booking, {
    name: 'Booking', scope: 'tenant', operations: { ...operations, Create: { scope: 'public' } },
  }).CreateBooking;
  expectTypeOf(pub.Route.scope).toEqualTypeOf<'public'>();
  expectTypeOf<ResponseTypeUnionOf<typeof pub>['code']>().toEqualTypeOf<201 | DefaultFailureCode<'public'>>();
  expectTypeOf<ResponseTypeUnionOf<typeof publicOverride>>().toEqualTypeOf<ResponseTypeUnionOf<typeof pub>>();
  expectTypeOf<ResponseTypeUnionOf<typeof account>['code']>().toEqualTypeOf<201 | DefaultFailureCode<'account'>>();
  const unauthorized = { code: 401, error: 'Auth.UNAUTHENTICATED', traceId: 'r1' } as const;
  // @ts-expect-error The public default contract has no 401 response.
  expect(pub.ResponseTypeUnion.safeDecode(unauthorized).success).toBe(false);
  expect(account.ResponseTypeUnion.decode(unauthorized)).toEqual(unauthorized);
  expect(publicOverride.Route.scope).toBe('public');
});

it('retains every possible status for optional, widened or absent scopes', () => {
  const make = (override?: { scope?: 'account' | 'public' }) => endpoints(Booking, {
    name: 'Booking', scope: 'public', operations: { ...operations, Create: override },
  }).CreateBooking;
  expectTypeOf<ReturnType<typeof make>['Route']['scope']>().toEqualTypeOf<'account' | 'public'>();
  expectTypeOf<ResponseTypeUnionOf<ReturnType<typeof make>>['code']>().toEqualTypeOf<201 | DefaultFailureCode<'account'>>();
  expect(make().Route.scope).toBe('public');
  expect(make({ scope: 'account' }).Route.scope).toBe('account');
  expectTypeOf<ResponseTypeUnionOf<typeof CreateBooking>['code']>().toEqualTypeOf<201 | DefaultFailureCode>();
  const fromOptions = (options: CreateEndpointsOptions<'Booking'>) => endpoints(Booking, options).CreateBooking;
  expectTypeOf<ReturnType<typeof fromOptions>['Route']['scope']>().toEqualTypeOf<'public' | 'account' | 'tenant'>();
  const fromSettings = (Create: Record<string, unknown>) => endpoints(Booking, {
    name: 'Booking', scope: 'public', operations: { ...operations, Create },
  }).CreateBooking;
  expectTypeOf<ReturnType<typeof fromSettings>['Route']['scope']>().toEqualTypeOf<'public' | 'account' | 'tenant'>();
  expect(fromSettings({ scope: 'tenant' }).Route.scope).toBe('tenant');
});

it('separates decoded request values from the wire body and materializes defaults on incoming requests', () => {
  const startsAt = new Date('2026-11-19T12:15:00Z');
  const content = CreateBooking.toContent({ startsAt });
  expect(content).toEqual({ body: { startsAt: startsAt.toISOString(), tags: [] }, params: {}, query: {}, headers: {} });
  const request = CreateBooking.fromContent({ ...content, body: { startsAt: '2026-11-19T14:15:00+02:00' } });
  expectTypeOf(request).toEqualTypeOf<RequestOf<typeof CreateBooking>>();
  expectTypeOf(request.tags).toEqualTypeOf<string[]>();
  expect(request).toEqual({ startsAt, tags: [] });
  for (const extra of ['id', 'confirmation', 'internalMemo']) {
    expect(CreateBooking.RequestContent.safeParse({ ...content, body: { ...content.body, [extra]: 'x' } }).success).toBe(false);
  }
  for (const section of ['params', 'query', 'headers'] as const) {
    expect(CreateBooking.RequestContent.safeParse({ ...content, [section]: { field: 'x' } }).success).toBe(false);
  }
});

it('uses only Create success and the route’s applicable failures', () => {
  const busy = { code: 429, error: 'Traffic.LIMIT', traceId: 't1' };
  expect(CreateBooking.ResponseTypeUnion.parse(busy)).toEqual(busy);
  expect(CreateBooking.ResponseTypeUnion.safeParse({ ...busy, code: 402 }).success).toBe(false);
  const data = {
    id: '018f515e-0cca-7000-8000-000000000001', startsAt: '2026-11-19T12:15:00Z', tags: [], confirmation: 'confirmed',
  };
  expect(CreateBooking.Response.safeParse({ code: 201, data }).success).toBe(true);
  expect(CreateBooking.Response.safeParse({ code: 200, data }).success).toBe(false);
});

it('reports unsupported route shapes at declaration time', () => {
  // @ts-expect-error Parented Create contracts need an additional path-to-request mapping.
  expect(() => endpoints(Booking, { name: 'Booking', operations, parent: { name: 'Team' } })).toThrow(ApiDefinitionError);
});
