import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { bindCreateRequest, type BindCreateRequestOptions } from '../../src/endpoints/bindCreateRequest.js';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import type { RequestContentOf, RequestOf } from '../../src/endpoints/endpointTypes.js';
import { dateWireCodec } from '../../src/wire/date.js';
import { numberWireCodec } from '../../src/wire/number.js';

const top = crudRouteMetadata({ name: 'Chapter' }).find(route => route.operation === 'Create')!;
const nested = crudRouteMetadata({ name: 'Chapter', parent: { name: 'Book' } }).find(route => route.operation === 'Create')!;
const date = '2026-11-19T12:30:00.000Z';
const instant = new Date(date);
const shape = { bookId: numberWireCodec, opens: dateWireCodec, title: z.string().min(1) };
const request = z.strictObject(shape).refine(data => data.bookId > 0 && data.title !== 'reserved', { message: 'Invalid chapter' });
const bound = bindCreateRequest({ route: nested, request });
const wire = { params: { bookId: '7' }, body: { opens: date, title: 'Intro' }, query: {}, headers: {} };
const flat = { bookId: 7, opens: instant, title: 'Intro' };

it('binds the generated parent and row codecs to a four-section Create request', () => {
  expect(bound.Request).toBe(request);
  expect(bound.toContent(flat)).toEqual(wire);
  expect(bound.fromContent(wire)).toEqual(flat);
  const parsed = bound.RequestContent.decode(wire);
  expect(parsed).toEqual({ ...wire, params: { bookId: 7 }, body: { opens: instant, title: 'Intro' } });
  expect(bound.RequestContent.encode(parsed)).toEqual(wire);
  expectTypeOf<RequestOf<typeof bound>>().toEqualTypeOf<typeof flat>();
  expectTypeOf<RequestContentOf<typeof bound>['params']>().toEqualTypeOf<{ bookId: string }>();
  expectTypeOf<RequestContentOf<typeof bound>['body']>().toEqualTypeOf<{ opens: string; title: string }>();
});

it('uses only the body on a top-level Create and maps an explicit parent alias both ways', () => {
  const chapter = bindCreateRequest({ route: top, request: z.strictObject({ opens: dateWireCodec }) });
  const simple = chapter.toContent({ opens: instant });
  expect(simple).toEqual({ params: {}, query: {}, body: { opens: date }, headers: {} });
  expect(chapter.fromContent(simple)).toEqual({ opens: instant });
  expectTypeOf(simple.params).toEqualTypeOf<Record<string, never>>();
  expectTypeOf(simple.body).toEqualTypeOf<{ opens: string }>();
  const renamed = bindCreateRequest({ route: { ...nested, paramFields: { bookId: 'parentKey' } }, request: z.strictObject({ parentKey: numberWireCodec, opens: dateWireCodec }) });
  const sent = renamed.toContent({ parentKey: 7, opens: instant });
  expect(sent).toEqual({ ...simple, params: { bookId: '7' } });
  expect(renamed.fromContent(sent)).toEqual({ parentKey: 7, opens: instant });
  expectTypeOf(sent.params).toEqualTypeOf<{ bookId: string }>();
  expectTypeOf(sent.body).toEqualTypeOf<{ opens: string }>();
});

it('runs object refinements across parent and body fields and rejects invalid wire data', () => {
  expect(() => bound.fromContent({ ...wire, params: { bookId: '-1' } })).toThrow('Invalid chapter');
  expect(() => bound.toContent({ ...flat, title: 'reserved' })).toThrow('Invalid chapter');
  expect(() => bound.fromContent({ ...wire, body: { ...wire.body, opens: 'yesterday' } })).toThrow();
  expect(() => bound.toContent({ ...flat, title: '' })).toThrow();
  // @ts-expect-error A wire value cannot be passed in place of the decoded Date.
  expect(() => bound.toContent({ ...flat, opens: date })).toThrow();
  expect(() => bindCreateRequest({ route: nested, request: z.strictObject({ title: z.string() }) })).toThrow(/bookId.*request field/);
});

it('rejects undeclared fields or locations instead of losing values', () => {
  const strip = bindCreateRequest({ route: nested, request: z.object(shape) });
  const extraFlat = { ...flat, extra: 'cannot disappear' };
  expect(() => strip.toContent(extraFlat)).toThrow();
  const complete = { ...wire, cookies: {} };
  expect(() => strip.fromContent(complete)).toThrow();
  const misplaced = { ...wire, body: { ...wire.body, bookId: '7' } };
  expect(() => strip.fromContent(misplaced)).toThrow(/bookId.*path parameter/);
  for (const section of ['query', 'headers'] as const) {
    const extra = { ...wire, [section]: { title: 'cannot disappear' } };
    expect(() => strip.fromContent(extra)).toThrow();
  }
  const missing = { params: wire.params, body: wire.body, query: {} };
  // @ts-expect-error Every wire section is required.
  expect(() => strip.fromContent(missing)).toThrow();
  const hidden = { ...wire, body: Object.defineProperty({ ...wire.body }, 'extra', { value: 'hidden' }) };
  expect(() => strip.fromContent(hidden)).toThrow('enumerable string fields');
});

it('keeps explicitly declared catchall fields in the body', () => {
  const withNotes = bindCreateRequest({ route: top, request: z.object({ title: z.string() }).catchall(dateWireCodec) });
  const data = { title: 'Intro', extraDate: instant };
  // The Object schema validates its declared fields before applying the catchall.
  const content = withNotes.RequestContent.parse({ params: {}, body: { title: 'Intro', extraDate: date }, query: {}, headers: {} });
  expect(content.body).toEqual(data);
  expect(withNotes.fromContent({ params: {}, body: { title: 'Intro', extraDate: date }, query: {}, headers: {} })).toEqual(data);
  const withParent = bindCreateRequest({ route: nested, request: z.object({ bookId: z.string() }).catchall(z.string()) });
  const extra = { params: { bookId: '7' }, body: { note: 'kept' }, query: {}, headers: {} };
  expect(withParent.toContent({ bookId: '7', note: 'kept' })).toEqual(extra);
  expect(withParent.fromContent(extra)).toEqual({ bookId: '7', note: 'kept' });
  const duplicate = { ...extra, body: { bookId: '7' } };
  expect(withParent.RequestContent.safeParse(duplicate).success).toBe(false);
  expect(() => withParent.fromContent(duplicate)).toThrow(/bookId.*path parameter/);
});

it('applies the codecs as often as the original request schema with a cross-field refinement', () => {
  let encodes = 0;
  let decodes = 0;
  const count = z.codec(z.string(), z.number(), {
    decode: value => { decodes++; return Number(value); },
    encode: value => { encodes++; return String(value); },
  });
  const request = z.strictObject({ bookId: count, minimum: z.number() }).refine(value => value.bookId > value.minimum);
  const create = bindCreateRequest({ route: nested, request });
  const baseline = request.encode({ bookId: 2, minimum: 1 });
  request.decode(baseline);
  const originalEncodes = encodes, originalDecodes = decodes;
  encodes = decodes = 0;
  const content = create.toContent({ bookId: 2, minimum: 1 });
  expect([encodes, decodes]).toEqual([originalEncodes, 0]);
  expect(create.fromContent(content)).toEqual({ bookId: 2, minimum: 1 });
  expect([encodes, decodes]).toEqual([originalEncodes, originalDecodes]);
});

function forward<const Options extends BindCreateRequestOptions>(options: Options) { return bindCreateRequest(options); }
it('keeps erased route placements conservative while retaining the flat request type', () => {
  const route: BindCreateRequestOptions['route'] = { ...nested };
  const custom = forward({ route, request });
  const content = custom.toContent(flat);
  expectTypeOf(content.body.opens).toEqualTypeOf<string | undefined>();
  expect(custom.fromContent(content)).toEqual(flat);
  expectTypeOf(custom.fromContent(content)).toEqualTypeOf<typeof flat>();
  const path: `/prefix/${string}` = '/prefix/:bookId';
  const foreign = forward({ route: { ...nested, path }, request });
  const different = foreign.toContent(flat);
  expect(different).toEqual(wire);
  expectTypeOf(different.body.bookId).toEqualTypeOf<string | undefined>();
});

it('keeps field placement conservative when a parent can have either resource name', () => {
  function forParent(name: 'Book' | 'Series') {
    const route = crudRouteMetadata({ name: 'Chapter', parent: { name } }).find(item => item.operation === 'Create')!;
    return bindCreateRequest({ route, request: z.strictObject({ bookId: numberWireCodec, seriesId: numberWireCodec }) });
  }
  const flat = { bookId: 3, seriesId: 4 };
  const book = forParent('Book').toContent(flat);
  const series = forParent('Series').toContent(flat);
  expect(book).toMatchObject({ params: { bookId: '3' }, body: { seriesId: '4' } });
  expect(series).toMatchObject({ params: { seriesId: '4' }, body: { bookId: '3' } });
  expectTypeOf(book.params.bookId).toEqualTypeOf<string | undefined>();
  expectTypeOf(book.body.seriesId).toEqualTypeOf<string | undefined>();
});
