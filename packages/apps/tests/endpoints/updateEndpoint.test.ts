import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { RequestOf, ResponseTypeUnionOf } from '../../src/endpoints/endpointTypes.js';
import type { CreateOnly, Defaulted, Editable, Id, UpdateOnly, WriteOnly } from '../../src/model/access.js';
import { createResourceSystem } from '../../src/model/createResourceSystem.js';

const onlyUpdate = { Create: false, Get: false, Update: true, Delete: false, List: false } as const;

it('round-trips an inherited primary key and only the supplied update fields', () => {
  const resources = createResourceSystem({ roles: ['VIEWER', 'EDITOR', 'ADMIN'] });
  const { Prop, Resource, endpoints } = resources;
  class Row {
    @Prop.number({ crud: 'id', min: 1 }) key!: Id<number>;
  }
  @Resource()
  class Booking extends Row {
    @Prop.date({ crud: 'editable' }) startsAt!: Editable<Date>;
    @Prop(z.array(z.string()).default(['initial']), { crud: 'editable' }) tags!: Defaulted<Editable<string[]>>;
    @Prop(z.string().nullable(), { crud: 'updateOnly' }) note!: UpdateOnly<string | null>;
    @Prop.string({ crud: 'createOnly' }) source!: CreateOnly<string>;
    @Prop.string({ crud: 'writeOnly' }) token!: WriteOnly<string>;
  }
  const result = endpoints(Booking, { name: 'Booking', operations: onlyUpdate,
    access: { write: 'EDITOR', update: 'ADMIN', fields: { token: { write: 'ADMIN' } } } });
  expectTypeOf<keyof typeof result>().toEqualTypeOf<'UpdateBooking'>();
  const { UpdateBooking } = result;
  expect(resources.declaredEndpoints).toEqual([UpdateBooking]);
  expectTypeOf(UpdateBooking.Method).toEqualTypeOf<'patch'>();
  expectTypeOf(UpdateBooking.Route.paramFields.bookingId).toEqualTypeOf<'key'>();
  expectTypeOf(UpdateBooking.Access).toEqualTypeOf<'ADMIN'>();
  expect(UpdateBooking).toMatchObject({ Method: 'patch', Path: '/bookings/:bookingId', FieldAccess: { token: { write: 'ADMIN' } } });
  type Request = RequestOf<typeof UpdateBooking>;
  expectTypeOf<Request['key']>().toEqualTypeOf<number>();
  expectTypeOf<Request['startsAt']>().toEqualTypeOf<Date | undefined>();
  expectTypeOf<keyof Request>().toEqualTypeOf<'key' | 'startsAt' | 'tags' | 'note' | 'token'>();
  expectTypeOf<ResponseTypeUnionOf<typeof UpdateBooking>['code']>().toEqualTypeOf<200 | 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503>();
  const note = UpdateBooking.toContent({ key: 23, note: null });
  expect(note).toEqual({ params: { bookingId: '23' }, query: {}, body: { note: null }, headers: {} });
  expect(UpdateBooking.fromContent(note)).toStrictEqual({ key: 23, note: null });
  expect(UpdateBooking.fromContent(UpdateBooking.toContent({ key: 23 }))).toStrictEqual({ key: 23 });
  const when = new Date('2026-11-19T12:00:00Z');
  const withDate = UpdateBooking.toContent({ key: 23, startsAt: when, tags: [], token: 'changed' });
  expect(withDate.body).toEqual({ startsAt: when.toISOString(), tags: [], token: 'changed' });
  expectTypeOf(withDate.body.startsAt).toEqualTypeOf<string | undefined>();
  expect(UpdateBooking.fromContent(withDate)).toEqual({ key: 23, startsAt: when, tags: [], token: 'changed' });
  const stored = { key: 23, startsAt: when, tags: ['kept'], note: null, source: 'first', token: 'internal' };
  expect(UpdateBooking.Response.encode({ code: 200, data: stored })).toEqual({
    code: 200, data: { key: '23', startsAt: when.toISOString(), tags: ['kept'], note: null, source: 'first' },
  });
  expect(UpdateBooking.Request.safeParse({ source: 'later', key: 23 }).success).toBe(false);
  expect(UpdateBooking.Request.safeParse({ note: 'no key' }).success).toBe(false);
  for (const value of [
    { body: { key: 23 } }, { body: { source: 'later' } }, { body: { unknown: true } }, { query: { note: 'x' } },
    { params: { bookingId: '0' } }, { params: { bookingId: 23 } }, { params: {} },
  ]) {
    expect(UpdateBooking.RequestContent.safeParse({ ...note, ...value }).success).toBe(false);
  }
});

it('treats an editable primary key as a path selector, including when a write rule is declared for it', () => {
  const { Prop, Resource, endpoints } = createResourceSystem({ roles: ['EDITOR', 'ADMIN'] });
  @Resource()
  class Label {
    @Prop.string({ crud: { access: 'editable', id: true } }) key!: Id<string> & Editable<string>;
    @Prop.string({ crud: 'editable' }) title!: Editable<string>;
  }
  const { UpdateLabel } = endpoints(Label, { name: 'Label', operations: onlyUpdate,
    access: { write: 'EDITOR', fields: { key: { write: 'ADMIN' }, title: { write: 'EDITOR' } } } });
  const wire = UpdateLabel.toContent({ key: 'a', title: 'hello' });
  expect(UpdateLabel.FieldAccess).toEqual({ title: { write: 'EDITOR' } });
  expectTypeOf<keyof typeof wire.body>().toEqualTypeOf<'title'>();
  expect(wire).toEqual({ params: { labelId: 'a' }, body: { title: 'hello' }, query: {}, headers: {} });
  expect(UpdateLabel.RequestContent.safeParse({ ...wire, body: { key: 'different' } }).success).toBe(false);
});
