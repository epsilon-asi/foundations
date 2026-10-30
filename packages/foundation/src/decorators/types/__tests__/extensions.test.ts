import { z } from 'zod/v4';
import { createTypeRegistry, defineTypeExtension, TypeRegistryError } from '../index';
import type { AnyTypeExtension } from '../index';

const http = defineTypeExtension({
  key: 'http',
  field: z.object({
    in: z.enum(['body', 'query', 'param', 'header']).default('body'),
    name: z.string().optional(),
  }),
  type: z.object({ path: z.string().startsWith('/') }),
  decorators: (api) => ({
    Query: (name?: string) => api.field({ in: 'query', name }),
    Param: (name?: string) => api.field({ in: 'param', name }),
    Route: (path: string) => api.type({ path }),
  }),
});

const orm = defineTypeExtension({
  key: 'orm',
  field: z.object({ column: z.string() }),
});

const audit = defineTypeExtension({
  key: 'audit',
  type: z.object({ retainDays: z.number() }),
});

function compose() {
  const root = createTypeRegistry({ namespace: 'extensions' });
  return { root, types: root.use(http).use(orm).use(audit) };
}

describe('type extensions', () => {
  it('validates inline options with the extension schema, applying its defaults', () => {
    const { types } = compose();
    const { Type, Prop, resolve } = types;

    @Type({ http: { path: '/users' }, audit: { retainDays: 30 } })
    class CreateUser {
      @Prop(z.string().email(), { http: {}, orm: { column: 'email_address' } })
      email!: string;

      @Prop(z.string(), { http: { in: 'query', name: 'ref' } })
      referrer!: string;

      @Prop(z.number())
      age!: number;
    }

    const type = resolve(CreateUser);
    expect(type.extensions).toEqual({ http: { path: '/users' }, audit: { retainDays: 30 } });
    expect(type.fields.get('email')?.extensions).toEqual({
      http: { in: 'body' },
      orm: { column: 'email_address' },
    });
    expect(type.fields.get('referrer')?.extensions).toEqual({ http: { in: 'query', name: 'ref' } });
    expect(type.fields.get('age')?.extensions).toEqual({});

    // Extension options never leak into the zod schema.
    expect(Object.keys(type.object.shape)).toEqual(['email', 'referrer', 'age']);
    expect(type.jsonSchema()).not.toHaveProperty('properties.email.http');
  });

  it('records the same slot through standalone and custom decorators', () => {
    const { types } = compose();
    const { Type, Prop, resolve, extensions } = types;
    const { Query, Param, Route } = extensions.http;

    @Route('/users/:id')
    @Type()
    class GetUser {
      @Param('id')
      @Prop(z.string().uuid())
      id!: string;

      @Query()
      @Prop.boolean({ optional: true })
      expand?: boolean;

      @extensions.orm.field({ column: 'tenant_id' })
      @Prop(z.string())
      tenant!: string;
    }

    const type = resolve(GetUser);
    expect(type.extensions).toEqual({ http: { path: '/users/:id' } });
    expect(type.fields.get('id')?.extensions).toEqual({ http: { in: 'param', name: 'id' } });
    expect(type.fields.get('expand')?.extensions).toEqual({ http: { in: 'query' } });
    expect(type.fields.get('tenant')?.extensions).toEqual({ orm: { column: 'tenant_id' } });
  });

  it('exposes the raw front doors even when an extension defines custom decorators', () => {
    const { types } = compose();

    expect(Object.keys(types.extensions)).toEqual(['http', 'orm', 'audit']);
    expect(Object.keys(types.extensions.http).sort()).toEqual(['Param', 'Query', 'Route', 'field', 'type']);
    expect(Object.keys(types.extensions.orm).sort()).toEqual(['field', 'type']);
  });

  it('keeps the raw front doors when custom decorators try to shadow them', () => {
    const shadow = { key: 'shadow', field: z.string(), decorators: () => ({ field: 'nope', type: 'nope' }) };
    const types = createTypeRegistry().use(shadow as unknown as AnyTypeExtension);

    expect(typeof (types.extensions as Record<string, { field: unknown }>).shadow.field).toBe('function');
  });

  describe('one slot per concern', () => {
    it('rejects an inline option and a standalone decorator for the same concern on one field', () => {
      const { types } = compose();
      const { Prop, resolve, extensions } = types;

      class Conflict {
        @extensions.http.Query()
        @Prop(z.string(), { http: { in: 'body' } })
        value!: string;
      }

      expect(() => resolve(Conflict)).toThrow(
        'Extension "http" is declared more than once on field "value" of Conflict. ' +
          'Use either the inline option or the standalone decorator, not both.',
      );
    });

    it('rejects two standalone decorators for the same concern on one field', () => {
      const { types } = compose();
      const { Prop, resolve, extensions } = types;

      class Twice {
        @extensions.http.Query()
        @extensions.http.Param()
        @Prop(z.string())
        value!: string;
      }

      expect(() => resolve(Twice)).toThrow(/Extension "http" is declared more than once on field "value"/);
    });

    it('rejects an inline option and a standalone decorator for the same concern on one class', () => {
      const { types } = compose();
      const { Type, resolve, extensions } = types;

      @extensions.http.Route('/b')
      @Type({ http: { path: '/a' } })
      class Conflict {}

      expect(() => resolve(Conflict)).toThrow(/Extension "http" is declared more than once on Conflict/);
    });

    it('requires a standalone field decorator to be paired with @Prop in the same class', () => {
      const { types } = compose();
      const { Prop, resolve, extensions } = types;

      class Base {
        @Prop(z.string())
        value!: string;
      }

      class Unpaired extends Base {
        @extensions.http.Query()
        other!: string;
      }

      expect(() => resolve(Unpaired)).toThrow(
        'Extension "http" on field "other" must be paired with @Prop in the same class (resolving Unpaired).',
      );

      class InheritedOnly extends Base {
        @extensions.http.Query()
        value!: string;
      }

      expect(() => resolve(InheritedOnly)).toThrow(/Extension "http" on field "value" must be paired with @Prop/);
    });

    it('drops standalone options that belong to a base field a subclass redeclared', () => {
      const { types } = compose();
      const { Prop, resolve, extensions } = types;

      class Base {
        @extensions.http.Query()
        @Prop(z.string())
        value!: string;
      }

      class Redeclared extends Base {
        @Prop(z.string(), { orm: { column: 'v' } })
        value!: string;
      }

      expect(resolve(Base).fields.get('value')?.extensions).toEqual({ http: { in: 'query' } });
      expect(resolve(Redeclared).fields.get('value')?.extensions).toEqual({ orm: { column: 'v' } });
    });

    it('does not inherit class-level extension options', () => {
      const { types } = compose();
      const { Type, Prop, resolve, extensions } = types;

      @extensions.audit.type({ retainDays: 7 })
      @Type({ http: { path: '/base' } })
      class Base {
        @Prop(z.string())
        id!: string;
      }

      class Child extends Base {}

      expect(resolve(Base).extensions).toEqual({ http: { path: '/base' }, audit: { retainDays: 7 } });
      expect(resolve(Child).extensions).toEqual({});
    });
  });

  describe('resolve-time validation', () => {
    it('reports an extension that is not registered on the resolving registry', () => {
      const { root, types } = compose();

      class UsesHttp {
        @types.Prop(z.string(), { http: { in: 'query' } })
        value!: string;
      }

      // Decorations are shared, so the composed registry sees the class too.
      expect(types.resolve(UsesHttp).fields.get('value')?.extensions).toEqual({ http: { in: 'query' } });

      let caught: unknown;
      try {
        root.resolve(UsesHttp);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(TypeRegistryError);
      expect((caught as Error).message).toBe(
        'field "value" of UsesHttp declares extension "http", but this registry has no extension with that key. ' +
          'Register it with .use().',
      );
      expect(caught).toMatchObject({ typeName: 'UsesHttp', field: 'value', extension: 'http' });
    });

    it('records options at decoration time even before the extension is registered', () => {
      const root = createTypeRegistry();

      // Decorated through a registry that does not know "http" yet.
      class Early {
        @root.Prop(z.string(), { http: { in: 'header' } } as object)
        token!: string;
      }

      expect(() => root.resolve(Early)).toThrow(/declares extension "http"/);
      expect(root.use(http).resolve(Early).fields.get('token')?.extensions).toEqual({ http: { in: 'header' } });
    });

    it('reports invalid options with the zod error as the cause', () => {
      const { types } = compose();
      const { Type, Prop, resolve } = types;

      class BadField {
        @Prop(z.string(), { http: { in: 'cookie' as 'body' } })
        value!: string;
      }

      @Type({ http: { path: 'no-slash' } })
      class BadType {}

      let caught: unknown;
      try {
        resolve(BadField);
      } catch (error) {
        caught = error;
      }

      expect((caught as Error).message).toMatch(/^Invalid "http" options on field "value" of BadField:\n/);
      expect((caught as Error).cause).toBeInstanceOf(z.ZodError);
      expect(caught).toMatchObject({ extension: 'http', field: 'value', typeName: 'BadField' });

      expect(() => resolve(BadType)).toThrow(/^Invalid "http" options on BadType:/);
    });

    it('rejects options for a level the extension does not support', () => {
      const { types } = compose();
      const { Type, Prop, resolve, extensions } = types;

      class FieldAudit {
        @extensions.audit.field(undefined as never)
        @Prop(z.string())
        value!: string;
      }

      @Type({ orm: { column: 'x' } } as object)
      class TypeOrm {}

      expect(() => resolve(FieldAudit)).toThrow(
        'Extension "audit" does not accept field-level options (declared on field "value" of FieldAudit).',
      );
      expect(() => resolve(TypeOrm)).toThrow('Extension "orm" does not accept type-level options (declared on TypeOrm).');
    });

    it('rejects standalone decorators on static and symbol fields at decoration time', () => {
      const { types } = compose();
      const sym = Symbol('sym');

      expect(() => {
        class StaticField {
          @types.extensions.orm.field({ column: 'c' })
          static value: string;
        }
        return StaticField;
      }).toThrow('Extension "orm" cannot be used on static field "value"; types describe instance data.');

      expect(() => {
        class SymbolField {
          @types.extensions.orm.field({ column: 'c' })
          [sym]!: string;
        }
        return SymbolField;
      }).toThrow(/Extension "orm" cannot be used on symbol field/);
    });
  });

  describe('use()', () => {
    it.each([
      ['an empty key', { key: '' }, 'Type extensions need a non-empty string key.'],
      ['a missing key', {}, 'Type extensions need a non-empty string key.'],
      ['a reserved key', { key: 'description' }, 'Extension key "description" is reserved by @Type/@Prop options.'],
      ['a reserved shorthand key', { key: 'optional' }, 'Extension key "optional" is reserved by @Type/@Prop options.'],
      ['a non-zod field schema', { key: 'x', field: {} }, 'Extension "x" field options must be a zod schema.'],
      ['a non-zod type schema', { key: 'x', type: 'nope' }, 'Extension "x" type options must be a zod schema.'],
    ])('rejects %s', (_label, extension, message) => {
      expect(() => createTypeRegistry().use(extension as AnyTypeExtension)).toThrow(message);
    });

    it('rejects a duplicate key', () => {
      expect(() => createTypeRegistry().use(http).use(http)).toThrow(
        'An extension with key "http" is already registered.',
      );
    });

    it('returns a new registry and leaves the original unchanged', () => {
      const root = createTypeRegistry();
      const withHttp = root.use(http);

      expect(withHttp).not.toBe(root);
      expect(Object.keys(root.extensions)).toEqual([]);
      expect(Object.keys(withHttp.extensions)).toEqual(['http']);
      expect(withHttp.namespace).toBe(root.namespace);
      expect(withHttp.Prop).toBe(root.Prop);
    });
  });
});

describe('one extension across multiple classes', () => {
  function single() {
    return createTypeRegistry({ namespace: 'one-extension' }).use(http);
  }

  it('resolves each class with its own type-level and field-level options', () => {
    const { Type, Prop, resolve, extensions } = single();
    const { Query, Param, Route } = extensions.http;

    @Type({ http: { path: '/users' } })
    class CreateUser {
      @Prop(z.string().email(), { http: {} })
      email!: string;
    }

    @Route('/users/:id')
    @Type()
    class GetUser {
      @Param('id')
      @Prop(z.string().uuid())
      id!: string;

      @Query()
      @Prop.boolean({ optional: true })
      expand?: boolean;
    }

    @Type({ http: { path: '/users' } })
    class ListUsers {
      @Query('page')
      @Prop.number({ integer: true, optional: true })
      page?: number;
    }

    expect(resolve(CreateUser).extensions).toEqual({ http: { path: '/users' } });
    expect(resolve(GetUser).extensions).toEqual({ http: { path: '/users/:id' } });
    expect(resolve(ListUsers).extensions).toEqual({ http: { path: '/users' } });

    expect(resolve(CreateUser).fields.get('email')?.extensions).toEqual({ http: { in: 'body' } });
    expect(resolve(GetUser).fields.get('id')?.extensions).toEqual({ http: { in: 'param', name: 'id' } });
    expect(resolve(GetUser).fields.get('expand')?.extensions).toEqual({ http: { in: 'query' } });
    expect(resolve(ListUsers).fields.get('page')?.extensions).toEqual({ http: { in: 'query', name: 'page' } });
  });

  it('keeps options for same-named fields separate per class', () => {
    const { Prop, resolve } = single();

    class FromBody {
      @Prop(z.string(), { http: { in: 'body' } })
      id!: string;
    }

    class FromPath {
      @Prop(z.string(), { http: { in: 'param' } })
      id!: string;
    }

    class FromHeader {
      @Prop(z.string(), { http: { in: 'header', name: 'x-id' } })
      id!: string;
    }

    expect(resolve(FromBody).fields.get('id')?.extensions).toEqual({ http: { in: 'body' } });
    expect(resolve(FromPath).fields.get('id')?.extensions).toEqual({ http: { in: 'param' } });
    expect(resolve(FromHeader).fields.get('id')?.extensions).toEqual({ http: { in: 'header', name: 'x-id' } });
  });

  it('resolves classes without options alongside classes that declare them', () => {
    const { Type, Prop, resolve } = single();

    @Type()
    class Plain {
      @Prop(z.string())
      name!: string;
    }

    @Type({ http: { path: '/tagged' } })
    class Tagged {
      @Prop(z.string(), { http: { in: 'query' } })
      name!: string;
    }

    expect(resolve(Plain).extensions).toEqual({});
    expect(resolve(Plain).fields.get('name')?.extensions).toEqual({});
    expect(resolve(Tagged).extensions).toEqual({ http: { path: '/tagged' } });
    expect(resolve(Tagged).fields.get('name')?.extensions).toEqual({ http: { in: 'query' } });
  });

  it('fails only the class whose options are invalid', () => {
    const { Prop, resolve } = single();

    class Invalid {
      @Prop(z.string(), { http: { in: 'cookie' as 'body' } })
      value!: string;
    }

    class Valid {
      @Prop(z.string(), { http: { in: 'header' } })
      value!: string;
    }

    expect(() => resolve(Invalid)).toThrow(/^Invalid "http" options on field "value" of Invalid:/);
    expect(resolve(Valid).fields.get('value')?.extensions).toEqual({ http: { in: 'header' } });
    expect(() => resolve(Invalid)).toThrow(TypeRegistryError);
  });

  it("resolves a nested class with its own options, not its parent's", () => {
    const { Type, Prop, ref, resolve } = single();

    @Type({ http: { path: '/addresses' } })
    class Address {
      @Prop(z.string(), { http: { in: 'query' } })
      city!: string;
    }

    @Type({ http: { path: '/orders' } })
    class Order {
      @Prop.nested(() => Address, { http: { in: 'body' } })
      shipping!: Address;

      @Prop(z.array(ref(() => Address)), { http: {} })
      previous!: Address[];
    }

    const order = resolve(Order);
    expect(order.extensions).toEqual({ http: { path: '/orders' } });
    expect(order.fields.get('shipping')?.extensions).toEqual({ http: { in: 'body' } });
    expect(order.fields.get('previous')?.extensions).toEqual({ http: { in: 'body' } });
    expect(order.safeParse({ shipping: { city: 'A' }, previous: [{ city: 'B' }] }).success).toBe(true);

    expect(resolve(Address).extensions).toEqual({ http: { path: '/addresses' } });
    expect(resolve(Address).fields.get('city')?.extensions).toEqual({ http: { in: 'query' } });
  });

  it('gives every subclass the inherited fields with their base options', () => {
    const { Prop, resolve } = single();

    class Base {
      @Prop(z.string(), { http: { in: 'header', name: 'x-tenant' } })
      tenant!: string;
    }

    class SearchRequest extends Base {
      @Prop(z.string(), { http: { in: 'query' } })
      term!: string;
    }

    class ItemRequest extends Base {
      @Prop(z.string(), { http: { in: 'param' } })
      id!: string;
    }

    expect([...resolve(SearchRequest).fields.keys()]).toEqual(['tenant', 'term']);
    expect([...resolve(ItemRequest).fields.keys()]).toEqual(['tenant', 'id']);
    expect(resolve(SearchRequest).fields.get('tenant')?.extensions).toEqual({
      http: { in: 'header', name: 'x-tenant' },
    });
    expect(resolve(ItemRequest).fields.get('tenant')?.extensions).toEqual({
      http: { in: 'header', name: 'x-tenant' },
    });
    expect(resolve(ItemRequest).fields.get('id')?.extensions).toEqual({ http: { in: 'param' } });
  });
});

describe('two extensions across multiple classes', () => {
  function dual() {
    const root = createTypeRegistry({ namespace: 'two-extensions' });
    return { root, types: root.use(http).use(orm) };
  }

  it('resolves each class with only the extensions it declares', () => {
    const { types } = dual();
    const { Type, Prop, resolve } = types;

    @Type({ http: { path: '/users' } })
    class UserRow {
      @Prop(z.string(), { http: { in: 'param' }, orm: { column: 'user_id' } })
      id!: string;

      @Prop(z.string(), { orm: { column: 'email_address' } })
      email!: string;
    }

    @Type({ http: { path: '/search' } })
    class SearchRequest {
      @Prop(z.string(), { http: { in: 'query' } })
      term!: string;
    }

    class AuditRow {
      @Prop(z.string(), { orm: { column: 'actor' } })
      actor!: string;
    }

    class Note {
      @Prop(z.string())
      text!: string;
    }

    expect(resolve(UserRow).extensions).toEqual({ http: { path: '/users' } });
    expect(resolve(UserRow).fields.get('id')?.extensions).toEqual({
      http: { in: 'param' },
      orm: { column: 'user_id' },
    });
    expect(resolve(UserRow).fields.get('email')?.extensions).toEqual({ orm: { column: 'email_address' } });

    expect(resolve(SearchRequest).extensions).toEqual({ http: { path: '/search' } });
    expect(resolve(SearchRequest).fields.get('term')?.extensions).toEqual({ http: { in: 'query' } });

    expect(resolve(AuditRow).extensions).toEqual({});
    expect(resolve(AuditRow).fields.get('actor')?.extensions).toEqual({ orm: { column: 'actor' } });

    expect(resolve(Note).extensions).toEqual({});
    expect(resolve(Note).fields.get('text')?.extensions).toEqual({});
  });

  it('combines inline options and standalone decorators of different extensions on one field', () => {
    const { types } = dual();
    const { Prop, resolve, extensions } = types;

    class Mixed {
      @extensions.orm.field({ column: 'ref' })
      @Prop(z.string(), { http: { in: 'query' } })
      ref!: string;

      @extensions.http.Param('id')
      @Prop(z.string(), { orm: { column: 'id' } })
      id!: string;

      @extensions.http.Query()
      @extensions.orm.field({ column: 'page' })
      @Prop(z.number())
      page!: number;
    }

    @extensions.http.Route('/others')
    class Other {
      @extensions.orm.field({ column: 'name' })
      @Prop(z.string(), { http: { in: 'header' } })
      name!: string;
    }

    expect(resolve(Mixed).fields.get('ref')?.extensions).toEqual({
      http: { in: 'query' },
      orm: { column: 'ref' },
    });
    expect(resolve(Mixed).fields.get('id')?.extensions).toEqual({
      http: { in: 'param', name: 'id' },
      orm: { column: 'id' },
    });
    expect(resolve(Mixed).fields.get('page')?.extensions).toEqual({
      http: { in: 'query' },
      orm: { column: 'page' },
    });

    expect(resolve(Other).extensions).toEqual({ http: { path: '/others' } });
    expect(resolve(Other).fields.get('name')?.extensions).toEqual({
      http: { in: 'header' },
      orm: { column: 'name' },
    });
  });

  it('resolves the same classes identically regardless of use() order', () => {
    const root = createTypeRegistry({ namespace: 'use-order' });
    const httpFirst = root.use(http).use(orm);
    const ormFirst = root.use(orm).use(http);
    const { Type, Prop } = httpFirst;

    @Type({ http: { path: '/a' } })
    class First {
      @Prop(z.string(), { http: { in: 'query' }, orm: { column: 'a' } })
      a!: string;
    }

    class Second {
      @Prop(z.number(), { orm: { column: 'b' } })
      b!: number;

      @Prop(z.string(), { http: { in: 'header' } })
      c!: string;
    }

    expect(Object.keys(httpFirst.extensions)).toEqual(['http', 'orm']);
    expect(Object.keys(ormFirst.extensions)).toEqual(['orm', 'http']);

    for (const target of [First, Second]) {
      const left = httpFirst.resolve(target);
      const right = ormFirst.resolve(target);

      expect(right.extensions).toEqual(left.extensions);
      expect(right.object).toBe(left.object);
      for (const [name, field] of left.fields) {
        expect(right.fields.get(name)?.extensions).toEqual(field.extensions);
      }
    }
  });

  it('lets a registry with only one of the extensions resolve only the classes that use it', () => {
    const { root, types } = dual();
    const httpOnly = root.use(http);
    const ormOnly = root.use(orm);
    const { Prop } = types;

    class SearchRequest {
      @Prop(z.string(), { http: { in: 'query' } })
      term!: string;
    }

    class TableRow {
      @Prop(z.string(), { orm: { column: 'c' } })
      c!: string;
    }

    class Both {
      @Prop(z.string(), { http: {}, orm: { column: 'b' } })
      b!: string;
    }

    expect(httpOnly.resolve(SearchRequest).fields.get('term')?.extensions).toEqual({ http: { in: 'query' } });
    expect(() => httpOnly.resolve(TableRow)).toThrow(/declares extension "orm"/);
    expect(() => httpOnly.resolve(Both)).toThrow(/declares extension "orm"/);

    expect(ormOnly.resolve(TableRow).fields.get('c')?.extensions).toEqual({ orm: { column: 'c' } });
    expect(() => ormOnly.resolve(SearchRequest)).toThrow(/declares extension "http"/);
    expect(() => ormOnly.resolve(Both)).toThrow(/declares extension "http"/);

    expect(types.resolve(Both).fields.get('b')?.extensions).toEqual({
      http: { in: 'body' },
      orm: { column: 'b' },
    });
  });
});

describe('two registries with one extension across multiple classes', () => {
  function pair() {
    return {
      first: createTypeRegistry({ namespace: 'first' }).use(http),
      second: createTypeRegistry({ namespace: 'second' }).use(http),
    };
  }

  it("resolves each registry's classes through that registry only", () => {
    const { first, second } = pair();

    @first.Type({ http: { path: '/a' } })
    class FirstA {
      @first.Prop(z.string(), { http: { in: 'query' } })
      a!: string;
    }

    @first.Type()
    class FirstB {
      @first.extensions.http.Param()
      @first.Prop(z.string())
      b!: string;
    }

    @second.Type({ http: { path: '/c' } })
    class SecondC {
      @second.Prop(z.string(), { http: {} })
      c!: string;
    }

    @second.extensions.http.Route('/d')
    class SecondD {
      @second.extensions.http.Query()
      @second.Prop(z.string())
      d!: string;
    }

    expect(first.resolve(FirstA).extensions).toEqual({ http: { path: '/a' } });
    expect(first.resolve(FirstA).fields.get('a')?.extensions).toEqual({ http: { in: 'query' } });
    expect(first.resolve(FirstB).fields.get('b')?.extensions).toEqual({ http: { in: 'param' } });
    expect(second.resolve(SecondC).extensions).toEqual({ http: { path: '/c' } });
    expect(second.resolve(SecondC).fields.get('c')?.extensions).toEqual({ http: { in: 'body' } });
    expect(second.resolve(SecondD).extensions).toEqual({ http: { path: '/d' } });
    expect(second.resolve(SecondD).fields.get('d')?.extensions).toEqual({ http: { in: 'query' } });

    for (const target of [FirstA, FirstB]) {
      expect(() => second.resolve(target)).toThrow(TypeRegistryError);
      expect(() => second.resolve(target)).toThrow(`${target.name} is not a registered type`);
    }
    for (const target of [SecondC, SecondD]) {
      expect(() => first.resolve(target)).toThrow(TypeRegistryError);
      expect(() => first.resolve(target)).toThrow(`${target.name} is not a registered type`);
    }
  });

  it('gives each registry its own view of a class decorated through both', () => {
    const { first, second } = pair();

    @first.Type({ name: 'FirstView', http: { path: '/first' } })
    @second.Type({ name: 'SecondView', http: { path: '/second' } })
    class Shared {
      @first.Prop(z.string(), { description: 'first', http: { in: 'query' } })
      @second.Prop(z.string().min(3), { description: 'second', http: { in: 'header' } })
      token!: string;

      @second.Prop(z.number())
      onlySecond!: number;
    }

    const viewA = first.resolve(Shared);
    const viewB = second.resolve(Shared);

    expect(viewA.name).toBe('FirstView');
    expect(viewB.name).toBe('SecondView');
    expect(viewA.extensions).toEqual({ http: { path: '/first' } });
    expect(viewB.extensions).toEqual({ http: { path: '/second' } });

    expect([...viewA.fields.keys()]).toEqual(['token']);
    expect([...viewB.fields.keys()]).toEqual(['token', 'onlySecond']);
    expect(viewA.fields.get('token')?.description).toBe('first');
    expect(viewB.fields.get('token')?.description).toBe('second');
    expect(viewA.fields.get('token')?.extensions).toEqual({ http: { in: 'query' } });
    expect(viewB.fields.get('token')?.extensions).toEqual({ http: { in: 'header' } });

    expect(viewA.safeParse({ token: 'ab' }).success).toBe(true);
    expect(viewB.safeParse({ token: 'ab', onlySecond: 1 }).success).toBe(false);
    expect(viewB.safeParse({ token: 'abc', onlySecond: 1 }).success).toBe(true);
  });

  it("keeps a standalone decorator from one registry out of the other registry's view", () => {
    const { first, second } = pair();

    class Mixed {
      @first.extensions.http.Query()
      @second.Prop(z.string())
      value!: string;
    }

    expect(second.resolve(Mixed).fields.get('value')?.extensions).toEqual({});
    expect(() => first.resolve(Mixed)).toThrow('Mixed is not a registered type');
  });

  it('does not follow nested references into the other registry', () => {
    const { first, second } = pair();

    @second.Type()
    class Address {
      @second.Prop(z.string())
      city!: string;
    }

    @first.Type()
    class Order {
      @first.Prop.nested(() => Address, { http: {} })
      shipping!: Address;
    }

    expect(first.resolve(Order).fields.get('shipping')?.extensions).toEqual({ http: { in: 'body' } });
    expect(() => first.resolve(Order).parse({ shipping: { city: 'A' } })).toThrow('Address is not a registered type');
    expect(second.resolve(Address).parse({ city: 'A' })).toEqual({ city: 'A' });
  });

  it('keeps decorators, caches, and namespaces separate per registry', () => {
    const { first, second } = pair();

    class Cached {
      @first.Prop(z.string(), { http: {} })
      @second.Prop(z.string(), { http: {} })
      a!: string;
    }

    expect(first.namespace).toBe('first');
    expect(second.namespace).toBe('second');
    expect(first.Prop).not.toBe(second.Prop);
    expect(first.extensions.http).not.toBe(second.extensions.http);
    expect(first.extensions.http.Query).not.toBe(second.extensions.http.Query);

    expect(first.resolve(Cached)).toBe(first.resolve(Cached));
    expect(second.resolve(Cached)).toBe(second.resolve(Cached));
    expect(first.resolve(Cached)).not.toBe(second.resolve(Cached));
    expect(first.resolve(Cached).object).not.toBe(second.resolve(Cached).object);
  });

  it('shares classes between registries composed from the same root', () => {
    const root = createTypeRegistry({ namespace: 'same-root' });
    const left = root.use(http);
    const right = root.use(http);

    class SharedA {
      @left.Prop(z.string(), { http: { in: 'query' } })
      a!: string;
    }

    @right.Type({ http: { path: '/b' } })
    class SharedB {
      @right.extensions.http.Param()
      @right.Prop(z.string())
      b!: string;
    }

    expect(left.extensions.http).not.toBe(right.extensions.http);
    expect(right.resolve(SharedA).fields.get('a')?.extensions).toEqual({ http: { in: 'query' } });
    expect(left.resolve(SharedB).extensions).toEqual({ http: { path: '/b' } });
    expect(left.resolve(SharedB).fields.get('b')?.extensions).toEqual({ http: { in: 'param' } });
    expect(left.resolve(SharedA).object).toBe(right.resolve(SharedA).object);
  });
});

describe('two registries with two extensions across multiple classes', () => {
  function pair() {
    return {
      first: createTypeRegistry({ namespace: 'first' }).use(http).use(orm),
      second: createTypeRegistry({ namespace: 'second' }).use(orm).use(http),
    };
  }

  it("resolves each registry's classes with both extensions, isolated from the other registry", () => {
    const { first, second } = pair();

    @first.Type({ http: { path: '/users' } })
    class FirstUser {
      @first.Prop(z.string(), { http: { in: 'param' }, orm: { column: 'user_id' } })
      id!: string;

      @first.extensions.orm.field({ column: 'email_address' })
      @first.Prop(z.string().email())
      email!: string;
    }

    class FirstAudit {
      @first.Prop(z.string(), { orm: { column: 'actor' } })
      actor!: string;
    }

    @second.extensions.http.Route('/orders')
    class SecondOrder {
      @second.extensions.http.Param('orderId')
      @second.Prop(z.string(), { orm: { column: 'order_id' } })
      id!: string;

      @second.extensions.orm.field({ column: 'total_cents' })
      @second.Prop(z.number().int(), { http: {} })
      total!: number;
    }

    @second.Type({ http: { path: '/search' } })
    class SecondSearch {
      @second.extensions.http.Query()
      @second.Prop(z.string())
      term!: string;
    }

    expect(first.resolve(FirstUser).extensions).toEqual({ http: { path: '/users' } });
    expect(first.resolve(FirstUser).fields.get('id')?.extensions).toEqual({
      http: { in: 'param' },
      orm: { column: 'user_id' },
    });
    expect(first.resolve(FirstUser).fields.get('email')?.extensions).toEqual({ orm: { column: 'email_address' } });
    expect(first.resolve(FirstAudit).fields.get('actor')?.extensions).toEqual({ orm: { column: 'actor' } });

    expect(second.resolve(SecondOrder).extensions).toEqual({ http: { path: '/orders' } });
    expect(second.resolve(SecondOrder).fields.get('id')?.extensions).toEqual({
      http: { in: 'param', name: 'orderId' },
      orm: { column: 'order_id' },
    });
    expect(second.resolve(SecondOrder).fields.get('total')?.extensions).toEqual({
      http: { in: 'body' },
      orm: { column: 'total_cents' },
    });
    expect(second.resolve(SecondSearch).fields.get('term')?.extensions).toEqual({ http: { in: 'query' } });

    for (const target of [FirstUser, FirstAudit]) {
      expect(() => second.resolve(target)).toThrow(`${target.name} is not a registered type`);
    }
    for (const target of [SecondOrder, SecondSearch]) {
      expect(() => first.resolve(target)).toThrow(`${target.name} is not a registered type`);
    }
  });

  it('gives each registry its own view of a class decorated through both', () => {
    const { first, second } = pair();

    @first.Type({ http: { path: '/first' } })
    @second.Type({ http: { path: '/second' } })
    class Shared {
      @first.Prop(z.string(), { http: { in: 'query' }, orm: { column: 'first_col' } })
      @second.extensions.orm.field({ column: 'second_col' })
      @second.extensions.http.Param('key')
      @second.Prop(z.string())
      key!: string;

      @first.Prop(z.number(), { orm: { column: 'only_first' } })
      onlyFirst!: number;
    }

    const viewA = first.resolve(Shared);
    const viewB = second.resolve(Shared);

    expect(viewA.extensions).toEqual({ http: { path: '/first' } });
    expect(viewB.extensions).toEqual({ http: { path: '/second' } });
    expect([...viewA.fields.keys()]).toEqual(['key', 'onlyFirst']);
    expect([...viewB.fields.keys()]).toEqual(['key']);
    expect(viewA.fields.get('key')?.extensions).toEqual({
      http: { in: 'query' },
      orm: { column: 'first_col' },
    });
    expect(viewB.fields.get('key')?.extensions).toEqual({
      http: { in: 'param', name: 'key' },
      orm: { column: 'second_col' },
    });
  });

  it("validates with each registry's own definition when extensions share a key", () => {
    const httpV2 = defineTypeExtension({
      key: 'http',
      field: z.object({
        in: z.enum(['body', 'query', 'param', 'header']).default('query'),
        required: z.boolean().default(true),
      }),
      type: z.object({ path: z.string().startsWith('/'), version: z.number().default(2) }),
    });

    const first = createTypeRegistry({ namespace: 'http-v1' }).use(http).use(orm);
    const second = createTypeRegistry({ namespace: 'http-v2' }).use(httpV2).use(orm);

    @first.Type({ http: { path: '/v1' } })
    class V1Create {
      @first.Prop(z.string(), { http: {}, orm: { column: 'a' } })
      a!: string;
    }

    @first.Type({ http: { path: '/v1/list' } })
    class V1List {
      @first.Prop(z.number(), { http: { in: 'query' } })
      page!: number;
    }

    @second.Type({ http: { path: '/v2' } })
    class V2Create {
      @second.Prop(z.string(), { http: {}, orm: { column: 'a' } })
      a!: string;
    }

    @second.Type({ http: { path: '/v2/list', version: 3 } })
    class V2List {
      @second.Prop(z.number(), { http: { required: false } })
      page!: number;
    }

    expect(first.resolve(V1Create).extensions).toEqual({ http: { path: '/v1' } });
    expect(first.resolve(V1Create).fields.get('a')?.extensions).toEqual({
      http: { in: 'body' },
      orm: { column: 'a' },
    });
    expect(first.resolve(V1List).fields.get('page')?.extensions).toEqual({ http: { in: 'query' } });

    expect(second.resolve(V2Create).extensions).toEqual({ http: { path: '/v2', version: 2 } });
    expect(second.resolve(V2Create).fields.get('a')?.extensions).toEqual({
      http: { in: 'query', required: true },
      orm: { column: 'a' },
    });
    expect(second.resolve(V2List).extensions).toEqual({ http: { path: '/v2/list', version: 3 } });
    expect(second.resolve(V2List).fields.get('page')?.extensions).toEqual({
      http: { in: 'query', required: false },
    });
  });
});
