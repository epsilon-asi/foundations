import { expectTypeOf } from 'vitest';
import type { Id, Readable, WriteOnly } from '../../src/model/access.js';
import type { OffsetListResponseData } from '../../src/responses/offsetListResponseData.js';

declare class Company {
  id: Id<string>;
  name: Readable<string>;
  password: WriteOnly<string>;
}

type Companies = OffsetListResponseData<typeof Company, { name: 'Company'; plural: 'Companies' }>;
expectTypeOf<keyof Companies>().toEqualTypeOf<'companies' | 'count'>();
expectTypeOf<Companies['companies']>().toEqualTypeOf<{ id: string; name: string }[]>();
expectTypeOf<Companies['count']>().toEqualTypeOf<number>();

type ApiKeys = OffsetListResponseData<{ id: Id<number> }, { name: 'ApiKey' }>;
expectTypeOf<keyof ApiKeys>().toEqualTypeOf<'apiKeys' | 'count'>();
const page: Companies = { companies: [{ id: 'c-1', name: 'Foundry' }], count: 20 };
// @ts-expect-error The response requires its total count.
const missingCount: Companies = { companies: page.companies };
// @ts-expect-error The count must be numeric.
const stringCount: Companies = { ...page, count: '20' };
// @ts-expect-error The collection keeps its declared read model.
const invalidRow: Companies = { companies: [{ id: 12, name: 'Foundry' }], count: 1 };
// @ts-expect-error Rows are required even on an empty page.
const missingCollection: Companies = { count: 0 };

type OptionalPlural = OffsetListResponseData<Company, { name: 'Company'; plural?: 'Companies' }>;
const explicit: OptionalPlural = page;
const fallback: OptionalPlural = { companys: [], count: 0 };

// A key supplied dynamically may overlap the numeric count field.
type Dynamic = OffsetListResponseData<Company, { name: string; plural: string }>;
const dynamic: Dynamic = page;
type CollidingPlural = OffsetListResponseData<Company, { name: 'Company'; plural: 'Count' }>;
expectTypeOf<CollidingPlural>().toBeNever();
