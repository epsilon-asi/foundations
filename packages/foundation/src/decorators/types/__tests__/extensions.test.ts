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
