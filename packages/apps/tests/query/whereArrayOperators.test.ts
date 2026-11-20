import { createTypeRegistry } from '@epsilon-asi/foundation';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { Readable, Secret } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { cursorListQuerySchema } from '../../src/query/cursorListQuerySchema.js';
import { offsetListQuerySchema } from '../../src/query/offsetListQuerySchema.js';
import { wireInputJsonSchema } from '../../src/wire/wireInputJsonSchema.js';

const { Prop, resolve, ref } = createTypeRegistry().use(crudExtension);
const grade = z.codec(z.string().regex(/^P[0-9]$/), z.int().min(0).max(9), {
  decode: text => Number(text.slice(1)), encode: value => 'P' + value,
});
const percentage = z.codec(z.string().regex(/^[0-9]+%$/), z.strictObject({ value: z.int().min(0).max(100) }), {
  decode: text => ({ value: Number(text.slice(0, -1)) }), encode: ({ value }) => value + '%',
});
class Label {
  @Prop.number({ crud: 'readable' }) level!: Readable<number>;
  @Prop.string({ crud: 'secret' }) token!: Secret<string>;
  @Prop.string() internal!: string;
}
class Stored {
  @Prop(z.array(z.int().nonnegative()).length(3).nullable(), { crud: 'readable' }) ranks!: Readable<number[] | null>;
}
class Catalog extends Stored {
  @Prop(z.array(grade.catch(0)), { crud: 'readable' }) grades!: Readable<number[]>;
  @Prop(z.array(z.date().nullable()), { crud: 'readable' }) dates!: Readable<(Date | null)[]>;
  @Prop(z.array(z.array(z.bigint().positive()).min(1)), { crud: 'readable' }) batches!: Readable<bigint[][]>;
  @Prop(z.array(z.strictObject({ grade, flag: z.boolean().optional() })), { crud: 'readable' }) samples!: Readable<{ grade: number; flag?: boolean }[]>;
  @Prop(z.array(percentage), { crud: 'readable' }) percentages!: Readable<{ value: number }[]>;
  @Prop(z.array(ref(() => Label)), { crud: 'readable' }) labels!: Readable<Label[]>;
  @Prop.string({ crud: 'readable' }) title!: Readable<string>;
}
const model = resolve(Catalog);
const filter = { ranks: true, grades: ['$overlap'], dates: ['$contains'], batches: ['$contains'], samples: true, percentages: true, labels: true, title: true } as const;

describe.each([['offset', offsetListQuerySchema], ['cursor', cursorListQuerySchema]] as const)('%s array operators', (_mode, build) => {
  const list = build({ model, filter });

  it('round-trips element lists, including empty or repeated values, independently of the stored array length', () => {
    const where = { ranks: { $contains: ['2', '2'], $overlap: [], $eq: null, $exists: 'Off' }, grades: { $overlap: ['P4'] },
      dates: { $contains: [null, '2026-08-01T02:00:00+02:00'] }, batches: { $contains: [['9007199254740993']] },
      samples: { $contains: [{ grade: 'P2', flag: 'YES' }, { grade: 'P6' }] }, percentages: { $overlap: [{ value: '23' }] }, labels: { $overlap: [{ level: '2' }] } };
    const result = list.decode({ where });
    expect(result.where).toEqual({ ranks: { $contains: [2, 2], $overlap: [], $eq: null, $exists: false }, grades: { $overlap: [4] },
      dates: { $contains: [null, new Date('2026-08-01T00:00:00Z')] }, batches: { $contains: [[BigInt('9007199254740993')]] },
      samples: { $contains: [{ grade: 2, flag: true }, { grade: 6 }] }, percentages: { $overlap: [{ value: 23 }] }, labels: { $overlap: [{ level: 2 }] } });
    expect(z.encode(list, result).where).toEqual({ ...where, ranks: { ...where.ranks, $exists: 'false' },
      dates: { $contains: [null, '2026-08-01T00:00:00.000Z'] }, samples: { $contains: [{ grade: 'P2', flag: 'true' }, { grade: 'P6' }] } });
    expect(list.decode({ where: { ranks: { $contains: [] } } }).where).toEqual({ ranks: { $contains: [] } });
  });

  it('reports the invalid operator, item or nested property in each comparison', () => {
    for (const [where, path] of [
      [{ ranks: { $overlap: '3' } }, ['ranks', '$overlap']], [{ ranks: { $contains: null } }, ['ranks', '$contains']],
      [{ ranks: { $contains: ['1', '-2'] } }, ['ranks', '$contains', 1]], [{ ranks: { $overlap: [2] } }, ['ranks', '$overlap', 0]],
      [{ dates: { $contains: ['yesterday'] } }, ['dates', '$contains', 0]], [{ grades: { $overlap: ['4'] } }, ['grades', '$overlap', 0]],
      [{ batches: { $contains: [[]] } }, ['batches', '$contains', 0]], [{ batches: { $contains: [['0']] } }, ['batches', '$contains', 0, 0]],
      [{ samples: { $overlap: [{ grade: 'P4', flag: 'invalid' }] } }, ['samples', '$overlap', 0, 'flag']],
      [{ percentages: { $contains: [{ value: '101' }] } }, ['percentages', '$contains', 0, 'value']],
      [{ percentages: { $contains: ['20%'] } }, ['percentages', '$contains', 0]],
      [{ samples: { $contains: [{ grade: 'P4', ['__proto__']: 'invalid' }] } }, ['samples', '$contains', 0, '__proto__']],
      [{ labels: { $overlap: [{ level: '2', token: 'private' }] } }, ['labels', '$overlap', 0]],
      [{ grades: { $contains: ['P4'] } }, ['grades', '$contains']], [{ title: { $overlap: ['a'] } }, ['title', '$overlap']],
    ] as const) {
      expect(list.safeParse({ where }).error?.issues[0].path).toEqual(['where', ...path]);
    }
    const page = list.decode({});
    // @ts-expect-error Decoded array operands hold numbers.
    expect(z.safeEncode(list, { ...page, where: { ranks: { $overlap: ['1'] } } }).success).toBe(false);
    // @ts-expect-error An unlisted operation cannot be selected.
    expect(z.safeEncode(list, { ...page, where: { grades: { $contains: [4] } } }).success).toBe(false);
    // @ts-expect-error Resource elements contain only the readable projection.
    expect(z.safeEncode(list, { ...page, where: { labels: { $overlap: [{ level: 2, token: 'secret' }] } } }).success).toBe(false);
  });

  it('describes projected array items and their wire values', () => {
    const where = wireInputJsonSchema(list).properties?.where;
    expect(where).toMatchObject({ properties: {
      grades: { required: ['$overlap'], properties: { $overlap: { type: 'array', items: { type: 'string', pattern: '^P[0-9]$' } } } },
      batches: { properties: { $contains: { items: { type: 'array', minItems: 1, items: { type: 'string' } } } } },
      labels: { properties: { $contains: { items: { type: 'object', additionalProperties: false, properties: { level: { type: 'string' } } } } } },
    } });
    expect(JSON.stringify(where)).not.toContain('"token"');
    expect(JSON.stringify(where)).not.toContain('"internal"');
    type Stored = NonNullable<z.output<typeof list>['where']>;
    type Wire = NonNullable<z.input<typeof list>['where']>;
    expectTypeOf<NonNullable<Stored['ranks']>['$contains']>().toEqualTypeOf<number[] | undefined>();
    expectTypeOf<NonNullable<Wire['grades']>['$overlap']>().toEqualTypeOf<string[]>();
    expectTypeOf<NonNullable<Stored['dates']>['$contains']>().toEqualTypeOf<(Date | null)[]>();
    expectTypeOf<NonNullable<Wire['batches']>['$contains']>().toEqualTypeOf<string[][]>();
    type Label = NonNullable<NonNullable<Wire['labels']>['$contains']>[number];
    expectTypeOf<keyof Label>().toEqualTypeOf<'level'>();
    expectTypeOf<Label['level']>().toEqualTypeOf<string>();
  });

  it('keeps erased model metadata validated by the actual array declaration', () => {
    const { name, fields } = model;
    const query = build({ model: { name, fields }, filter: { grades: ['$overlap'] } });
    const result = query.decode({ where: { grades: { $overlap: ['P1', 'P3'] } } });
    expect(result.where?.grades).toEqual({ $overlap: [1, 3] });
    expect(z.encode(query, result).where?.grades).toEqual({ $overlap: ['P1', 'P3'] });
    expectTypeOf<NonNullable<NonNullable<typeof result.where>['grades']>['$overlap']>().toEqualTypeOf<unknown[]>();
  });
});

it('emits recursive array elements once in the final query document and projects every level', () => {
  class Branch {
    @Prop.number({ crud: 'readable' }) weight!: Readable<number>;
    @Prop(z.array(ref(() => Branch)).optional(), { crud: 'readable', description: 'Branches' }) children?: Readable<Branch[]>;
    @Prop.string({ crud: 'secret' }) password!: Secret<string>;
  }
  class Tree {
    @Prop(z.array(ref(() => Branch)), { crud: 'readable' }) branches!: Readable<Branch[]>;
  }
  const list = offsetListQuerySchema({ model: resolve(Tree), filter: { branches: true } });
  const page = list.decode({ where: { branches: { $overlap: [{ weight: '1', children: [{ weight: '2' }] }] } } });
  expect(page.where?.branches?.$overlap).toEqual([{ weight: 1, children: [{ weight: 2 }] }]);
  expect(list.encode(page).where?.branches?.$overlap).toEqual([{ weight: '1', children: [{ weight: '2' }] }]);
  expect(list.safeParse({ where: { branches: { $contains: [{ weight: '1', children: [{ weight: '2', password: 'private' }] }] } } }).error?.issues[0].path)
    .toEqual(['where', 'branches', '$contains', 0, 'children', 0]);
  const schema = wireInputJsonSchema(list);
  const refs = [...JSON.stringify(schema).matchAll(/"\$ref":"#\/\$defs\/([^"]+)"/g)].map(match => match[1]);
  expect(refs.length).toBeGreaterThan(0);
  for (const ref of refs) expect(Object.hasOwn(schema.$defs ?? {}, ref)).toBe(true);
  expect(JSON.stringify(schema)).not.toContain('"password"');
});
