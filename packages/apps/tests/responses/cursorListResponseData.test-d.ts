import { expectTypeOf } from 'vitest';
import type { Id, Readable, WriteOnly } from '../../src/model/access.js';
import type { CursorListResponseData } from '../../src/responses/cursorListResponseData.js';

declare class RecordWithId {
  id: Id<number>;
}
declare class Person extends RecordWithId {
  name: Readable<string>;
  password: WriteOnly<string>;
}

type People = CursorListResponseData<typeof Person, { name: 'Person'; plural: 'People' }>;
expectTypeOf<keyof People>().toEqualTypeOf<'people' | 'nextCursor'>();
expectTypeOf<People['people']>().toEqualTypeOf<{ id: number; name: string }[]>();
expectTypeOf<People['nextCursor']>().toEqualTypeOf<string | null>();

const more: People = { people: [{ id: 1, name: 'Ada' }], nextCursor: 'next+/=' };
const last: People = { people: [], nextCursor: null };
// @ts-expect-error The terminal page still carries its cursor field.
const missingCursor: People = { people: [] };
// @ts-expect-error Only an opaque string or null can be the next cursor.
const numericCursor: People = { ...more, nextCursor: 2 };
// @ts-expect-error Cursor paging carries no offset count.
const offsetCount: People = { ...last, count: 1 };
// @ts-expect-error The collection remains required on a terminal page.
const missingCollection: People = { nextCursor: null };
// @ts-expect-error The wire row's ID must match the resource's inherited ID type.
const invalidRow: People = { people: [{ id: '1', name: 'Ada' }], nextCursor: null };
// @ts-expect-error A write-only field has no place in the read model.
const withPassword: People = { people: [{ id: 1, name: 'Ada', password: 'x' }], nextCursor: null };

type DefaultPlural = CursorListResponseData<Person, { name: 'Person' }>;
expectTypeOf<keyof DefaultPlural>().toEqualTypeOf<'persons' | 'nextCursor'>();
type OptionalPlural = CursorListResponseData<Person, { name: 'Person'; plural?: 'People' }>;
const withOverride: OptionalPlural = more;
const withDefault: OptionalPlural = { persons: [], nextCursor: null };

type Dynamic = CursorListResponseData<Person, { name: string; plural: string }>;
const dynamicMore: Dynamic = more;
const dynamicLast: Dynamic = last;
expectTypeOf<Dynamic['nextCursor']>().toEqualTypeOf<string | null>();
type CollidingPlural = CursorListResponseData<Person, { name: 'Person'; plural: 'NextCursor' }>;
expectTypeOf<CollidingPlural>().toBeNever();
