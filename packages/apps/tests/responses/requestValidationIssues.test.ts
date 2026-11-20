import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { requestValidationIssues, type RequestValidationIssuesOptions } from '../../src/responses/requestValidationIssues.js';
import type { ValidationFailureResponse } from '../../src/responses/validationFailure.js';

function parseIssues(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error('Expected invalid request content.');
  return result.error.issues;
}

it('uses the CRUD route’s param mapping and preserves field issues from all four request sections', () => {
  const { Prop, resolve } = createTypeRegistry().use(crudExtension);
  class Chapter {
    @Prop.string({ crud: 'id' }) key!: string;
  }
  const route = crudRouteMetadata({ ...resolve(Chapter), parent: { name: 'Book' } }).find(route => route.operation === 'Update')!;
  const required = (message: string) => z.string().min(1, { error: message });
  const content = z.strictObject({
    params: z.strictObject({ bookId: required('book.required'), chapterId: z.uuid({ error: 'chapter.invalidKey' }) }),
    body: z.strictObject({ title: required('chapter.title'), tags: z.array(required('chapter.tag')) }),
    query: z.strictObject({ where: z.strictObject({ weight: z.strictObject({ $gt: z.number({ error: 'chapter.weight' }) }) }) }),
    headers: z.strictObject({ 'if-match': required('chapter.version') }),
  });
  const issues = parseIssues(content, {
    params: { bookId: '', chapterId: 'bad' }, body: { title: '', tags: ['', ''] },
    query: { where: { weight: { $gt: 'bad' } } }, headers: { 'if-match': '' },
  });
  const mapped = requestValidationIssues({ ...route, issues });
  expect(mapped).toEqual([
    { path: 'bookId', message: 'book.required', code: 'too_small' },
    { path: 'key', message: 'chapter.invalidKey', code: 'invalid_format' },
    { path: 'title', message: 'chapter.title', code: 'too_small' },
    { path: 'tags', message: 'chapter.tag', code: 'too_small' },
    { path: 'tags', message: 'chapter.tag', code: 'too_small' },
    { path: 'where', message: 'chapter.weight', code: 'invalid_type' },
    { path: 'if-match', message: 'chapter.version', code: 'too_small' },
  ]);
  expectTypeOf(mapped).toEqualTypeOf<ValidationFailureResponse['issues']>();
  expectTypeOf<Readonly<z.core.$ZodIssue[]>>().toEqualTypeOf<RequestValidationIssuesOptions['issues']>();
});

it('names each unexpected envelope and section key, and keeps nested keys on their owning field', () => {
  const strict = z.strictObject({}, { error: 'unexpected field' });
  const content = z.strictObject({
    params: strict,
    body: z.strictObject({ details: strict }, { error: 'unknown body field' }),
  }, { error: 'unknown envelope key' });
  const issues = parseIssues(content, {
    params: { chapterId: 'a', stale: 'b' },
    body: { details: { x: 1, y: 2 }, secret: 1, 'dotted.name': 2 },
    extra: 1, another: 2,
  });
  const mapped = requestValidationIssues({
    path: '/books/:bookId{/:chapterId}', paramFields: { chapterId: 'key', stale: 'unrelated' }, issues,
  });
  expect(mapped.map(issue => issue.path)).toEqual(['key', 'stale', 'details', 'secret', 'dotted.name', 'extra', 'another']);
  expect(mapped.map(issue => issue.message)).toEqual([
    'unexpected field', 'unexpected field', 'unexpected field', 'unknown body field', 'unknown body field',
    'unknown envelope key', 'unknown envelope key',
  ]);
  expect(mapped.every(issue => issue.code === 'unrecognized_keys')).toBe(true);
});

it('keeps root and whole-section validation on the form, including a section without an object', () => {
  const content = z.strictObject({
    body: z.strictObject({ title: z.string() }).refine(() => false, { error: 'invalid body' }),
  }).refine(() => false, { error: 'invalid combination' });
  const path = '/chapters';
  expect(requestValidationIssues({ path, issues: parseIssues(content, { body: { title: 'ok' } }) })).toEqual([
    { path: '', message: 'invalid body', code: 'custom' },
    { path: '', message: 'invalid combination', code: 'custom' },
  ]);
  const issues = parseIssues(content, { body: 2 });
  expect(requestValidationIssues({ path, issues })).toEqual([{ path: '', code: 'invalid_type', message: issues[0].message }]);
  expect(requestValidationIssues({ path, issues: [] })).toEqual([]);
});

it('ignores inherited aliases and never remaps a body field that shares a parameter name', () => {
  const fields = z.strictObject({ chapterId: z.string() });
  const issues = parseIssues(z.strictObject({ params: fields, body: fields }), { params: {}, body: {} });
  const path = '/books/:"chapterId"';
  const paramFields = Object.create({ chapterId: 'wrong' }) as Record<string, string>;
  expect(requestValidationIssues({ path, paramFields, issues }).map(issue => issue.path)).toEqual(['chapterId', 'chapterId']);
  expect(requestValidationIssues({ path, paramFields: { chapterId: 'key' }, issues }).map(issue => issue.path)).toEqual(['key', 'chapterId']);
});
