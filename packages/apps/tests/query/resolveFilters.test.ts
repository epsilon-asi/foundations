import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { Editable, Id, Readable } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { uiExtension } from '../../src/model/extensions/ui.js';
import { FILTER_OPERATORS, type ArrayOperator, type EnumOperator, type IdOperator, type TextOperator } from '../../src/query/filterOperators.js';
import { resolveFilters } from '../../src/query/resolveFilters.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension).use(uiExtension);
class StoredRecord {
  @Prop.uuid({ crud: 'id' }) key!: Id<string>;
}
const stages = z.literal(['draft', 'live']).or(z.enum(['live', 'archived'])).nullable().optional();
class CatalogItem extends StoredRecord {
  @Prop(stages, { crud: 'readable', ui: { label: 'catalog.publicationStage' } }) stage?: Readable<'draft' | 'live' | 'archived' | null>;
  @Prop.string({ crud: 'editable' }) title!: Editable<string>;
  @Prop.number({ crud: 'readable' }) rank!: Readable<number>;
  @Prop.boolean({ crud: 'readable' }) active!: Readable<boolean>;
  @Prop(z.array(z.string()).nullable(), { crud: 'readable' }) tags!: Readable<string[] | null>;
}
const model = resolve(CatalogItem);

it('exposes declared paths, operator groups, labels and enum choices in declaration order', () => {
  const filters = resolveFilters({ model, filter: { stage: true, key: true, title: true, rank: ['$gte'], active: true, tags: true } });
  expect(Object.keys(filters)).toEqual(['stage', 'key', 'title', 'rank', 'active', 'tags']);
  expect(filters).toEqual({
    stage: { path: 'stage', kind: 'enum', labelKey: 'catalog.publicationStage', values: ['draft', 'live', 'archived'], operators: [...FILTER_OPERATORS.enum, '$exists'] },
    key: { path: 'key', kind: 'id', labelKey: 'catalogItem.key', operators: FILTER_OPERATORS.id },
    title: { path: 'title', kind: 'text', labelKey: 'catalogItem.title', operators: FILTER_OPERATORS.text },
    rank: { path: 'rank', kind: 'range', labelKey: 'catalogItem.rank', operators: ['$gte'] },
    active: { path: 'active', kind: 'boolean', labelKey: 'catalogItem.active', operators: FILTER_OPERATORS.boolean },
    tags: { path: 'tags', kind: 'array', labelKey: 'catalogItem.tags', operators: [...FILTER_OPERATORS.array, ...FILTER_OPERATORS.nullable] },
  });
  expectTypeOf<keyof typeof filters>().toEqualTypeOf<'stage' | 'key' | 'title' | 'rank' | 'active' | 'tags'>();
  expectTypeOf(filters.stage.path).toEqualTypeOf<'stage'>();
  expectTypeOf(filters.stage.kind).toEqualTypeOf<'enum'>();
  expectTypeOf(filters.stage.values).toEqualTypeOf<readonly ('draft' | 'live' | 'archived')[]>();
  expectTypeOf(filters.stage.operators).toEqualTypeOf<readonly (EnumOperator | '$exists')[]>();
  expectTypeOf(filters.key.kind).toEqualTypeOf<'id'>();
  expectTypeOf(filters.key.operators).toEqualTypeOf<readonly IdOperator[]>();
  expectTypeOf<(typeof filters.title.operators)[number]>().toEqualTypeOf<TextOperator>();
  expectTypeOf(filters.rank.operators).toEqualTypeOf<readonly '$gte'[]>();
  expectTypeOf(filters.tags.operators).toEqualTypeOf<readonly (ArrayOperator | '$exists' | '$eq')[]>();
});

it('freezes each descriptor, choices and operators and keeps the first occurrence of a repeated option', () => {
  const cap: ('$in' | '$ne')[] = ['$in', '$ne', '$in'];
  const filters = resolveFilters({ model, filter: { stage: cap, active: [] } });
  cap.reverse();
  cap.push('$ne');
  expect(filters.stage.operators).toEqual(['$in', '$ne']);
  expect(filters.stage.values).toEqual(['draft', 'live', 'archived']);
  expect(filters.active.operators).toEqual([]);
  for (const value of [filters, filters.stage, filters.active, filters.stage.operators, filters.active.operators, filters.stage.values]) {
    expect(Object.isFrozen(value)).toBe(true);
  }
  expectTypeOf(filters.stage.operators).toEqualTypeOf<readonly ('$in' | '$ne')[]>();
  expectTypeOf(filters.active.operators).toEqualTypeOf<readonly never[]>();
});

it('returns frozen empty descriptors for previews and lists without filter caps', () => {
  const preview = resolveFilters({ filter: { possible: true } });
  for (const filters of [preview, resolveFilters(), resolveFilters({ model }), resolveFilters({ model, filter: {} })]) {
    expect(Object.keys(filters)).toEqual([]);
    expect(Object.isFrozen(filters)).toBe(true);
  }
  expectTypeOf<keyof typeof preview>().toEqualTypeOf<never>();
});

it('preserves the enum kind and frozen choices for a Zod enum with no values', () => {
  const field = { ...model.fields.get('stage')!, schema: z.enum([]) };
  const fields = new Map([['stage', field] as const]);
  const filters = resolveFilters({ model: { name: 'Empty', fields }, filter: { stage: true } });
  expect(filters.stage).toMatchObject({ kind: 'enum', values: [] });
  if (filters.stage.kind === 'enum') expect(Object.isFrozen(filters.stage.values)).toBe(true);
});

it('narrows a string with widened enum choices by its resolved kind', () => {
  const choices: string[] = ['daily', 'weekly'];
  class Schedule {
    @Prop(z.enum(choices), { crud: 'readable' }) frequency!: Readable<string>;
    @Prop.string({ crud: 'readable' }) title!: Readable<string>;
  }
  const filters = resolveFilters({ model: resolve(Schedule), filter: { frequency: true, title: ['$ilike'] } });
  expectTypeOf(filters.frequency.kind).toEqualTypeOf<'text' | 'enum'>();
  expectTypeOf(filters.title.kind).toEqualTypeOf<'text'>();
  expect(filters.frequency.kind).toBe('enum');
  if (filters.frequency.kind === 'enum') expect(filters.frequency.values).toEqual(choices);
});

it('resolves a directly declared prototype-named field in a null-prototype descriptor map', () => {
  const fields = new Map([['__proto__', model.fields.get('title')!] as const]);
  const filters = resolveFilters({ model: { name: 'Names', fields }, filter: { ['__proto__']: ['$ilike'] } });
  expect(Object.getPrototypeOf(filters)).toBeNull();
  expect(filters.__proto__).toEqual({ path: '__proto__', kind: 'text', labelKey: 'names.__proto__', operators: ['$ilike'] });
  expectTypeOf(filters.__proto__.path).toEqualTypeOf<'__proto__'>();
  expectTypeOf(filters.__proto__.operators).toEqualTypeOf<readonly '$ilike'[]>();
});
