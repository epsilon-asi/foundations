import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import { defaultFailureCodes } from '../../src/endpoints/defaultFailureCodes.js';
import { requestContentSchema } from '../../src/endpoints/requestContentSchema.js';
import { responseTypeUnion } from '../../src/endpoints/responseTypeUnion.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { crudSuccessResponseSchema } from '../../src/responses/crudSuccessResponseSchema.js';
import { validationFailureResponse, type ValidationFailureResponse, type ValidationFailureResponseOptions } from '../../src/responses/validationFailure.js';

it('round-trips mapped field and form issues through the parented Update endpoint’s response union', () => {
  const { Prop, resolve } = createTypeRegistry().use(crudExtension);
  class Chapter {
    @Prop.uuid({ crud: 'id' }) key!: string;
    @Prop.string({ crud: 'editable' }) title!: string;
  }
  const route = crudRouteMetadata({ ...resolve(Chapter), parent: { name: 'Book' } }).find(route => route.operation === 'Update')!;
  const UpdateChapter = {
    Route: route,
    RequestContent: requestContentSchema({
      params: z.strictObject({ bookId: z.string(), chapterId: z.uuid({ error: 'chapter.key.invalid' }) }),
      body: z.strictObject({ title: z.string().min(1, { error: 'chapter.title.required' }) }),
    }).refine(() => false, { error: 'chapter.form.invalid' }),
    ResponseTypeUnion: responseTypeUnion({
      response: crudSuccessResponseSchema({ route, row: z.strictObject({ key: z.uuid(), title: z.string() }) }),
      failures: defaultFailureCodes(route),
    }),
  };
  const parsed = UpdateChapter.RequestContent.safeParse({
    params: { bookId: 'A', chapterId: 'private raw input' }, query: {}, body: { title: '' }, headers: {},
  }, { reportInput: true });
  if (parsed.success) throw new Error('Expected invalid request content.');
  const response = validationFailureResponse({
    ...UpdateChapter.Route, zodError: parsed.error, error: 'Chapter.INVALID', traceId: 'req-42',
  });
  expectTypeOf(response).toEqualTypeOf<ValidationFailureResponse>();
  expectTypeOf(response.code).toEqualTypeOf<422>();
  expect(response).toEqual({
    code: 422, error: 'Chapter.INVALID', traceId: 'req-42',
    issues: [
      { path: 'key', message: 'chapter.key.invalid', code: 'invalid_format' },
      { path: 'title', message: 'chapter.title.required', code: 'too_small' },
      { path: '', message: 'chapter.form.invalid', code: 'custom' },
    ],
  });
  const wire = UpdateChapter.ResponseTypeUnion.encode(response);
  expect(wire).toEqual(response);
  expect(UpdateChapter.ResponseTypeUnion.decode(wire)).toEqual(response);
  expect(UpdateChapter.ResponseTypeUnion.safeParse({ ...wire, stack: parsed.error.stack }).success).toBe(false);
});

const options = {
  path: '/chapters', zodError: new z.core.$ZodError([]), error: 'Chapter.INVALID', traceId: 'req-42',
} satisfies ValidationFailureResponseOptions;

it.each(['INVALID', '.INVALID', 'Chapter.', 'Chapter.INVALID.FIELD', 'Chapter.BAD CODE'])('rejects the invalid wire error %j', error => {
  // @ts-expect-error Untyped callers may supply an unnamespaced identifier.
  expect(() => validationFailureResponse({ ...options, error })).toThrow(z.ZodError);
});

it('requires a Zod error and validates the wire trace ID without coercion', () => {
  // @ts-expect-error The originating error is required.
  expect(() => validationFailureResponse({ path: '/', error: 'Chapter.INVALID', traceId: '42' })).toThrow(TypeError);
  // @ts-expect-error An arbitrary error with an issues property is not a Zod error.
  expect(() => validationFailureResponse({ ...options, zodError: Object.assign(new Error(), { issues: [] }) })).toThrow(TypeError);
  // @ts-expect-error Trace IDs are strings on the response wire.
  expect(() => validationFailureResponse({ ...options, traceId: 42 })).toThrow(z.ZodError);
  expect(validationFailureResponse({ ...options, traceId: '' })).toEqual({ code: 422, error: 'Chapter.INVALID', traceId: '', issues: [] });
});
