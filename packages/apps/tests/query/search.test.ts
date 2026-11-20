import { createTypeRegistry } from '@epsilon-asi/foundation';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import type { CreateOnly, Editable, Internal, Readable, Secret, Tenant, UpdateOnly, WriteOnly } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { cursorListQuerySchema } from '../../src/query/cursorListQuerySchema.js';
import { offsetListQuerySchema } from '../../src/query/offsetListQuerySchema.js';
import { DEFAULT_MAX_SEARCH_LENGTH, searchQuerySchema } from '../../src/query/search.js';

const listQuery = z.object({ q: searchQuerySchema.optional() });

it.each(['a', '🔎'])('accepts 200 copies of %s and reports the 201st on q', character => {
  expect(DEFAULT_MAX_SEARCH_LENGTH).toBe(200);
  const q = character.repeat(DEFAULT_MAX_SEARCH_LENGTH);
  expect(listQuery.parse({ q })).toEqual({ q });
  expect(listQuery.safeParse({ q: q + character }).error?.issues).toMatchObject([
    { code: 'too_big', maximum: DEFAULT_MAX_SEARCH_LENGTH, path: ['q'] },
  ]);
});

it('preserves the supplied search text and allows an omitted q', () => {
  expect(listQuery.parse({ q: '  Road Map  ' })).toEqual({ q: '  Road Map  ' });
  expect(listQuery.parse({ q: '' })).toEqual({ q: '' });
  expect(listQuery.parse({})).toEqual({});
});

it('rejects a non-string search term', () => {
  expect(listQuery.safeParse({ q: 123 }).success).toBe(false);
});

const { Prop, resolve } = createTypeRegistry().use(crudExtension);

class CatalogRecord {
  @Prop.string({ crud: 'readable' }) title!: Readable<string>;
  @Prop.uuid({ crud: 'tenant' }) workspaceKey!: Tenant<string>;
  @Prop.string({ crud: { access: 'secret' } }) token!: Secret<string>;
}

class Offering extends CatalogRecord {
  @Prop.string({ crud: { access: 'editable' } }) summary!: Editable<string>;
  @Prop.string({ crud: 'createOnly' }) source!: CreateOnly<string>;
  @Prop.string({ crud: 'updateOnly' }) revision!: UpdateOnly<string>;
  @Prop(z.array(z.string()), { crud: 'readable' }) tags!: Readable<string[]>;
  @Prop.string() providerId!: string;
  @Prop.string({ crud: 'internal' }) memo!: Internal<string>;
  @Prop.string({ crud: 'writeOnly' }) credential!: WriteOnly<string>;
}

const model = resolve(Offering);

describe.each([
  ['offset', offsetListQuerySchema],
  ['cursor', cursorListQuerySchema],
] as const)('%s list search declarations', (_mode, build) => {
  it('allows inherited and local readable fields and enables q only for a search declaration', () => {
    const fields = ['title', 'summary', 'source', 'revision', 'workspaceKey', 'tags'] as const;
    const searchable = build({ model, search: { fields } });
    expect(searchable.decode({ q: 'book' })).toMatchObject({ q: 'book' });
    expect(build({ model }).safeParse({ q: 'book' }).success).toBe(false);
  });

  it.each([
    ['providerId', 'unreadable'], ['memo', 'unreadable'], ['credential', 'unreadable'],
    ['token', 'unreadable'], ['unknown', 'undeclared'],
  ])('rejects %s when building the list', (field, reason) => {
    const metadata = { name: model.name, fields: model.fields };
    const declare = () => build({ model: metadata, search: { fields: ['title', field] } });
    expect(declare).toThrow(ApiDefinitionError);
    expect(declare).toThrow(`Search on resource "Offering" includes the ${reason} field "${field}".`);
  });
});
