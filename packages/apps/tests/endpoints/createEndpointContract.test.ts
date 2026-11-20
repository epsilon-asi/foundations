import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { SUCCESS_CODES } from '../../src/responses/success.js';
import { dateWireCodec } from '../../src/wire/date.js';
import { numberWireCodec } from '../../src/wire/number.js';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { createEndpointContract } from '../../src/endpoints/createEndpointContract.js';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import type { RequestContentOf, RequestOf, ResponseDataOf, ResponseOf, ResponseTypeUnionOf } from '../../src/endpoints/endpointTypes.js';

const routes = crudRouteMetadata({ name: 'Chapter', parent: { name: 'Book' }, scope: 'public', access: { create: 'EDITOR' } });
const route = routes.find(candidate => candidate.operation === 'Create')!;
const request = z.strictObject({ bookId: numberWireCodec, title: z.string(), opens: dateWireCodec });
const row = z.strictObject({ chapterId: z.string(), title: z.string(), opens: dateWireCodec });
const options = { route, request, row };
const chapter = createEndpointContract(options);
const iso = '2026-11-19T12:30:00.000Z';
const opens = new Date(iso);

it('exposes the Create route and round-trips its nested request through the endpoint members', () => {
  expect(chapter.Route).toBe(route);
  expect(chapter).toMatchObject({ Name: 'CreateChapter', Kind: 'crud', Method: 'post', Path: '/books/:bookId/chapters', Access: 'EDITOR' });
  expectTypeOf(chapter.Name).toEqualTypeOf<'CreateChapter'>();
  expectTypeOf(chapter.Access).toEqualTypeOf<'EDITOR'>();
  expect(chapter.Request).toBe(request);
  const flat = { bookId: 7, title: 'Intro', opens };
  const wire = { params: { bookId: '7' }, body: { title: 'Intro', opens: iso }, query: {}, headers: {} };
  expectTypeOf<RequestOf<typeof chapter>>().toEqualTypeOf<typeof flat>();
  expectTypeOf<RequestContentOf<typeof chapter>['params']>().toEqualTypeOf<typeof wire.params>();
  expectTypeOf<RequestContentOf<typeof chapter>['body']>().toEqualTypeOf<typeof wire.body>();
  expect(chapter.toContent(flat)).toEqual(wire);
  expect(chapter.fromContent(wire)).toEqual(flat);
  const sections = chapter.RequestContent.decode(wire);
  expect(sections).toEqual({ ...wire, params: { bookId: 7 }, body: { title: 'Intro', opens } });
  expect(chapter.RequestContent.encode(sections)).toEqual(wire);
});

it('uses the readable row for the 201 response and derives failures from the same public route', () => {
  expect(chapter.ResponseData).toBe(row);
  const data = { chapterId: 'chapter-1', title: 'Intro', opens };
  const success = { code: SUCCESS_CODES.Created, data };
  const wire = { ...success, data: { ...data, opens: iso } };
  expectTypeOf<ResponseDataOf<typeof chapter>>().toEqualTypeOf<typeof data>();
  expectTypeOf<ResponseOf<typeof chapter>['data']>().toEqualTypeOf<typeof data>();
  expectTypeOf<ResponseOf<typeof chapter>['code']>().toEqualTypeOf<201>();
  expectTypeOf<ResponseTypeUnionOf<typeof chapter>['code']>().toEqualTypeOf<201 | 404 | 409 | 422 | 429 | 500>();
  expect(chapter.ResponseData.decode(wire.data)).toEqual(data);
  expect(chapter.Response.decode(wire)).toEqual(success);
  expect(chapter.ResponseTypeUnion.encode(success)).toEqual(wire);
  expect(chapter.ResponseTypeUnion.safeParse({ code: 404, error: 'Book.MISSING', traceId: 'r' }).success).toBe(true);
  expect(chapter.ResponseTypeUnion.safeParse({ code: 401, error: 'Auth.UNAUTHENTICATED', traceId: 'r' }).success).toBe(false);
});

it('honors explicit failure overrides including success alone', () => {
  const explicit = createEndpointContract({ ...options, failures: [401] });
  expectTypeOf<ResponseTypeUnionOf<typeof explicit>['code']>().toEqualTypeOf<201 | 401>();
  expect(explicit.ResponseTypeUnion.safeParse({ code: 401, error: 'Auth.UNAUTHENTICATED', traceId: 'r' }).success).toBe(true);
  expect(explicit.ResponseTypeUnion.safeParse({ code: 409, error: 'Chapter.CONFLICT', traceId: 'r' }).success).toBe(false);
  const empty = createEndpointContract({ ...options, failures: [] });
  expectTypeOf<ResponseTypeUnionOf<typeof empty>>().toEqualTypeOf<ResponseOf<typeof empty>>();
  expect(empty.ResponseTypeUnion).toBe(empty.Response);

  const maybe = (failures?: readonly [401]) => createEndpointContract({ ...options, failures });
  expectTypeOf<ResponseTypeUnionOf<ReturnType<typeof maybe>>['code']>().toEqualTypeOf<201 | 401 | 404 | 409 | 422 | 429 | 500>();
  expect(maybe().ResponseTypeUnion.safeParse({ code: 409, error: 'Chapter.CONFLICT', traceId: 'r' }).success).toBe(true);
});

it('rejects another operation at definition time', () => {
  const get = routes.find(candidate => candidate.operation === 'Get')!;
  // @ts-expect-error The route for a Create endpoint must be the collection's Create operation.
  expect(() => createEndpointContract({ ...options, route: get })).toThrow(ApiDefinitionError);
});
