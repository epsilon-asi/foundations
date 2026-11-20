import { createTypeRegistry } from '@epsilon-asi/foundation';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { Id, Readable } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { cursorListQuerySchema } from '../../src/query/cursorListQuerySchema.js';
import { offsetListQuerySchema } from '../../src/query/offsetListQuerySchema.js';
import { wireInputJsonSchema } from '../../src/wire/wireInputJsonSchema.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
const code = z.codec(z.string().regex(/^code:[a-z]+$/), z.string().regex(/^[A-Z]+$/), {
  decode: wire => wire.slice(5).toUpperCase(),
  encode: stored => 'code:' + stored.toLowerCase(),
});
class Document {
  @Prop.uuid({ crud: 'id' }) key!: Id<string>;
  @Prop(z.string().trim().min(4), { crud: 'readable' }) title!: Readable<string>;
  @Prop(code, { crud: 'readable' }) code!: Readable<string>;
  @Prop(z.string().nullable(), { crud: 'readable' }) note!: Readable<string | null>;
  @(Prop.enum(['draft', 'ready'], { crud: 'readable' })) state!: Readable<'draft' | 'ready'>;
  @Prop.date({ crud: 'readable' }) filedAt!: Readable<Date>;
  @Prop.number({ crud: 'readable' }) priority!: Readable<number>;
  @Prop.boolean({ crud: 'readable' }) active!: Readable<boolean>;
  @Prop(z.array(z.string()), { crud: 'readable' }) tags!: Readable<string[]>;
}
const model = resolve(Document);

describe.each([['offset', offsetListQuerySchema], ['cursor', cursorListQuerySchema]] as const)('%s text patterns', (_mode, build) => {
  const query = build({ model, filter: {
    title: ['$like'], code: true, note: ['$ilike'], key: true, state: true, filedAt: true, priority: true, active: true, tags: true,
  } });

  it('preserves pattern characters, case, whitespace and empty strings in both directions', () => {
    for (const pattern of ['', '%', '_', '\\', '  MiX%_\\_\n  ']) {
      const where = { title: { $like: pattern }, code: { $like: pattern, $ilike: pattern }, note: { $ilike: pattern } };
      const stored = query.decode({ where });
      expect(stored.where).toEqual(where);
      expect(z.encode(query, stored).where).toEqual(where);
    }
    const wire = { code: { $eq: 'code:alpha', $ne: 'code:beta', $like: 'al%', $ilike: 'BE_A' } };
    const stored = query.decode({ where: wire });
    expect(stored.where?.code).toEqual({ $eq: 'ALPHA', $ne: 'BETA', $like: 'al%', $ilike: 'BE_A' });
    expect(z.encode(query, stored).where).toEqual(wire);
    expect(query.safeParse({ where: { code: { $eq: 'al%', $ilike: 'al%' } } }).error?.issues[0].path).toEqual(['where', 'code', '$eq']);
  });

  it('allows only declared patterns on text fields, with a required string operand', () => {
    for (const [where, path] of [
      [{ title: { $ilike: 'a%' } }, ['title', '$ilike']], [{ note: { $like: '%' } }, ['note', '$like']],
      [{ title: {} }, ['title', '$like']], [{ code: {} }, ['code']],
      [{ note: { $ilike: null } }, ['note', '$ilike']], [{ code: { $like: undefined } }, ['code', '$like']],
      [{ title: { $like: 1 } }, ['title', '$like']], [{ code: { $ilike: ['%'] } }, ['code', '$ilike']],
      [{ key: { $ilike: '%' } }, ['key', '$ilike']], [{ state: { $like: '%' } }, ['state', '$like']],
      [{ filedAt: { $ilike: '%' } }, ['filedAt', '$ilike']], [{ priority: { $like: '%' } }, ['priority', '$like']],
      [{ active: { $like: '%' } }, ['active', '$like']], [{ tags: { $ilike: '%' } }, ['tags']],
    ] as const) {
      expect(query.safeParse({ where }).error?.issues[0].path).toEqual(['where', ...path]);
    }
    const stored = query.decode({});
    // @ts-expect-error A nullable text field still requires a string pattern.
    expect(z.safeEncode(query, { ...stored, where: { note: { $ilike: null } } }).error?.issues[0].path).toEqual(['where', 'note', '$ilike']);
    // @ts-expect-error Only the case-sensitive operator was declared here.
    expect(z.safeEncode(query, { ...stored, where: { title: { $ilike: 'A%' } } }).success).toBe(false);
    // @ts-expect-error An enum has no pattern comparisons.
    expect(z.safeEncode(query, { ...stored, where: { state: { $like: 'dra%' } } }).success).toBe(false);
    // @ts-expect-error A string primary key belongs to the id group.
    expect(z.safeEncode(query, { ...stored, where: { key: { $ilike: '9%' } } }).success).toBe(false);
    // @ts-expect-error A date has no pattern comparisons.
    expect(z.safeEncode(query, { ...stored, where: { filedAt: { $ilike: '2026%' } } }).success).toBe(false);
  });

  it('describes raw strings on the wire and in the decoded query', () => {
    const where = wireInputJsonSchema(query).properties?.where;
    expect(where).toMatchObject({ properties: {
      title: { required: ['$like'], additionalProperties: false }, note: { required: ['$ilike'] },
      code: { minProperties: 1, additionalProperties: false },
    } });
    for (const [path, operator] of [['title', '$like'], ['note', '$ilike'], ['code', '$like'], ['code', '$ilike']] as const) {
      const field = typeof where === 'object' && where.properties?.[path];
      expect(typeof field === 'object' && field.properties?.[operator]).toEqual({ type: 'string' });
    }
    type Stored = NonNullable<z.output<typeof query>['where']>;
    type Wire = NonNullable<z.input<typeof query>['where']>;
    expectTypeOf<keyof NonNullable<Stored['title']>>().toEqualTypeOf<'$like'>();
    expectTypeOf<NonNullable<Stored['note']>['$ilike']>().toEqualTypeOf<string>();
    expectTypeOf<NonNullable<Wire['title']>['$like']>().toEqualTypeOf<string>();
    expectTypeOf<NonNullable<Stored['code']>['$ilike']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<NonNullable<Wire['code']>['$ilike']>().toEqualTypeOf<string | undefined>();
  });
});
