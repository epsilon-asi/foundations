import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { apiVersionSchema } from '../../src/model/apiVersion.js';

const options = z.object({ apiVersion: apiVersionSchema });

it('leaves the version absent when the declaration omits it', () => {
  expect(options.parse({})).toStrictEqual({});
  expect(apiVersionSchema.parse(undefined)).toBeUndefined();
  expectTypeOf<z.output<typeof apiVersionSchema>>().toEqualTypeOf<string | undefined>();
});

it.each(['2026-11-16', '2024-02-29', '2000-02-29'])('preserves the calendar date %s', apiVersion => {
  expect(options.parse({ apiVersion })).toEqual({ apiVersion });
});

it.each([
  '2026-02-30', '1900-02-29', '2026-04-31', '2026-1-16',
  '2026-11-16T00:00:00Z', '2026-11-16\n', '', null, new Date('2026-11-16T00:00:00Z'),
])('reports an invalid version %j on the declaration field', apiVersion => {
  const result = options.safeParse({ apiVersion });
  expect(result.error?.issues[0].path).toEqual(['apiVersion']);
});
