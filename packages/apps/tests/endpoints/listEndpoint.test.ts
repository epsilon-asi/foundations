import { expect, expectTypeOf, it } from 'vitest';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import type { RequestOf, ResponseDataOf, ResponseTypeUnionOf } from '../../src/endpoints/endpointTypes.js';
import type { Id, Readable } from '../../src/model/access.js';
import { createResourceSystem } from '../../src/model/createResourceSystem.js';

const { Resource, Prop, endpoints } = createResourceSystem({ roles: ['VIEWER', 'EDITOR'] });
@Resource()
class Person {
  @Prop.string({ crud: 'id' }) id!: Id<string>;
  @Prop.date({ crud: 'readable' }) joined!: Readable<Date>;
  @Prop.string() internalMemo!: string;
}

const operations = { Create: false, Get: false, Update: false, Delete: false } as const;

it('derives the collection endpoint and turns optional numeric input into a bounded query', () => {
  const group = endpoints(Person, {
    name: 'Person', plural: 'People', operations, access: { read: 'VIEWER' }, list: { perPage: { default: 2, max: 3 } },
  });
  expectTypeOf<keyof typeof group>().toEqualTypeOf<'ListPeople'>();
  const endpoint = group.ListPeople;
  expectTypeOf(endpoint.Name).toEqualTypeOf<'ListPeople'>();
  expectTypeOf(endpoint.Route.name).toEqualTypeOf<'ListPeople'>();
  expectTypeOf(endpoint.Access).toEqualTypeOf<'VIEWER'>();
  expectTypeOf<RequestOf<typeof endpoint>>().toEqualTypeOf<{ page: number; perPage: number }>();
  expect(endpoint).toMatchObject({ Name: 'ListPeople', Method: 'get', Path: '/people', Filters: {}, Sorts: {} });
  expect(endpoint.toContent({ page: 1 })).toEqual({ params: {}, body: {}, headers: {}, query: { page: '1', perPage: '2' } });
  const wire = endpoint.toContent({});
  expect(endpoint.fromContent({ ...wire, query: {} })).toEqual({ page: 0, perPage: 2 });
  for (const query of [{ page: '-1' }, { perPage: '4' }, { perPage: ['1', '2'] }, { organizationId: 'other' }, { orderBy: {} }]) {
    expect(endpoint.RequestContent.safeParse({ ...wire, query }).success).toBe(false);
  }
  expect(() => endpoint.toContent({ perPage: 0 })).toThrow();
  expect(endpoint.Request.safeParse({ page: '1' }).success).toBe(false);
});

it('projects every row through the model and keeps count numeric on both sides of the wire', () => {
  const { ListPeople } = endpoints(Person, {
    name: 'Person', plural: 'People', operations, scope: 'public', access: { list: 'EDITOR', read: 'VIEWER' },
  });
  expect(ListPeople.Access).toBe('EDITOR');
  expectTypeOf<ResponseTypeUnionOf<typeof ListPeople>['code']>().toEqualTypeOf<200 | 422 | 429 | 500>();
  expectTypeOf<ResponseDataOf<typeof ListPeople>['people'][number]>().toEqualTypeOf<{ id: string; joined: Date }>();
  const joined = new Date('2026-11-20T00:00:00.000Z');
  const row = { id: 'a', joined, internalMemo: 'hidden' };
  const wire = ListPeople.Response.encode({ code: 200, data: { people: [row], count: 3 } });
  expect(wire).toEqual({ code: 200, data: { people: [{ id: 'a', joined: joined.toISOString() }], count: 3 } });
  expect(ListPeople.ResponseTypeUnion.parse(wire)).toEqual({ code: 200, data: { people: [{ id: 'a', joined }], count: 3 } });
  for (const data of [{ people: [] }, { people: [], count: -1 }, { people: [], count: '0' }, { persons: [], count: 0 }]) {
    expect(ListPeople.Response.safeParse({ code: 200, data }).success).toBe(false);
  }
});

it('distinguishes optional list operations and rejects unimplemented capabilities at declaration time', () => {
  const declare = (enabled: boolean) => endpoints(Person, {
    name: 'Person', operations: { ...operations, Get: true, List: enabled },
  });
  expectTypeOf<undefined>().toExtend<ReturnType<typeof declare>['ListPersons']>();
  expect(declare(false).ListPersons).toBeUndefined();
  expect(declare(true).ListPersons?.Name).toBe('ListPersons');
  const choosePlural = (plural?: 'People') => endpoints(Person, { name: 'Person', operations, plural });
  const group = choosePlural('People');
  if (!('ListPeople' in group)) throw new Error('Expected the explicit plural');
  expectTypeOf(group.ListPeople.Name).toEqualTypeOf<'ListPeople'>();
  expectTypeOf<keyof ResponseDataOf<typeof group.ListPeople>>().toEqualTypeOf<'people' | 'count'>();
  const defaultGroup = choosePlural();
  if (!('ListPersons' in defaultGroup)) throw new Error('Expected the default plural');
  expectTypeOf(defaultGroup.ListPersons.Name).toEqualTypeOf<'ListPersons'>();
  expectTypeOf<keyof ResponseDataOf<typeof defaultGroup.ListPersons>>().toEqualTypeOf<'persons' | 'count'>();
  const { ListPersons } = endpoints(Person, { name: 'Person', operations, plural: undefined });
  expectTypeOf(ListPersons.Name).toEqualTypeOf<'ListPersons'>();
  expectTypeOf<keyof ResponseDataOf<typeof ListPersons>>().toEqualTypeOf<'persons' | 'count'>();
  expect(() => endpoints(Person, {
    name: 'Person', operations,
    // @ts-expect-error Generated List handlers for this checkpoint serve offset paging.
    list: { paging: 'cursor' },
  })).toThrow(ApiDefinitionError);
  expect(() => endpoints(Person, { name: 'Person', plural: 'Count', operations })).toThrow(/collection key "count"/);
});

it('derives the caller, handler and wire types from the list declaration', () => {
  const { ListPersons } = endpoints(Person, {
    name: 'Person', operations, list: { filter: { joined: ['$eq'] }, sort: ['joined', 'id'] },
  });
  const joined = new Date('2025-01-02T12:30:00.000Z');
  const request = { where: { joined: { $eq: joined } }, orderBy: { id: 'asc', joined: 'desc' } } as const;
  const content = ListPersons.toContent(request);
  expect(content.query.where?.joined?.$eq).toBe(joined.toISOString());
  expect(ListPersons.fromContent(content)).toEqual({ ...request, page: 0, perPage: 20 });
  expectTypeOf(content.query.where?.joined?.$eq).toEqualTypeOf<string | undefined>();
  expectTypeOf<keyof typeof ListPersons.Filters>().toEqualTypeOf<'joined'>();
  expectTypeOf<keyof typeof ListPersons.Sorts>().toEqualTypeOf<'id' | 'joined'>();
  expect(() => ListPersons.toContent({
    // @ts-expect-error Native date operands are Date objects.
    where: { joined: { $eq: joined.toISOString() } },
  })).toThrow();
  expect(() => ListPersons.toContent({
    // @ts-expect-error Only the declared filter field is available.
    where: { id: { $eq: 'a' } },
  })).toThrow();
  expect(() => endpoints(Person, {
    // @ts-expect-error The field has no read grant.
    name: 'Person', operations, list: { sort: ['internalMemo'] },
  })).toThrow();
  expect(() => endpoints(Person, {
    // @ts-expect-error Every declared filter field must be readable.
    name: 'Person', operations, list: { filter: { joined: ['$eq'], internalMemo: ['$eq'] } },
  })).toThrow();
});
