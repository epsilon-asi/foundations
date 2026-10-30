import { z } from 'zod/v4';
import { createTypeRegistry, TypeRegistryError } from '../index';

describe('createTypeRegistry', () => {
  it('leaves zod usable after schemas are recorded through decorators', () => {
    const { Type, Prop, resolve } = createTypeRegistry({ namespace: 'zod-safety' });

    @Type()
    class Account {
      @Prop(z.string().min(3))
      handle!: string;

      @Prop(z.object({ street: z.string() }))
      address!: { street: string };
    }

    expect(resolve(Account).safeParse({ handle: 'ray', address: { street: 'Main' } }).success).toBe(true);

    // Deep-freezing a schema in decorator metadata used to break unrelated schemas process-wide.
    expect(z.string().email().safeParse('ray@example.com').success).toBe(true);
    expect(z.object({ a: z.string() }).safeParse({ a: 'x' }).success).toBe(true);
  });

  it('derives an object schema from @Type and @Prop', () => {
    const { Type, Prop, resolve } = createTypeRegistry();

    @Type({ name: 'User', description: 'An application user' })
    class UserInput {
      @Prop(z.string().email(), { description: 'Primary contact address' })
      email!: string;

      @Prop(z.number().int())
      age!: number;

      @Prop(z.string().optional())
      nickname?: string;
    }

    const type = resolve(UserInput);

    expect(type.target).toBe(UserInput);
    expect(type.name).toBe('User');
    expect(type.description).toBe('An application user');
    expect(type.mode).toBe('strip');
    expect([...type.fields.keys()]).toEqual(['email', 'age', 'nickname']);
    expect(type.fields.get('email')?.description).toBe('Primary contact address');
    expect(type.schema).toBe(type.object);

    expect(type.parse({ email: 'ray@example.com', age: 42 })).toEqual({ email: 'ray@example.com', age: 42 });
    expect(type.safeParse({ email: 'nope', age: 42 }).success).toBe(false);
    expect(() => type.parse({ email: 'ray@example.com', age: 4.2 })).toThrow(z.ZodError);
  });

  it('carries descriptions and meta into JSON Schema', () => {
    const { Type, Prop, resolve } = createTypeRegistry();

    @Type({ name: 'Widget', description: 'A widget', meta: { examples: [{ label: 'a' }] } })
    class Widget {
      @Prop(z.string().describe('from describe'), { description: 'from options', meta: { title: 'Label' } })
      label!: string;

      @Prop(z.string().describe('kept'))
      code!: string;
    }

    expect(resolve(Widget).jsonSchema()).toMatchObject({
      type: 'object',
      title: 'Widget',
      description: 'A widget',
      examples: [{ label: 'a' }],
      properties: {
        label: { type: 'string', description: 'from options', title: 'Label' },
        code: { type: 'string', description: 'kept' },
      },
      required: ['label', 'code'],
    });
  });

  it('passes JSON Schema params through to zod', () => {
    const { Prop, resolve } = createTypeRegistry();

    class Coerced {
      @Prop(z.string().default('x'))
      value!: string;
    }

    expect(resolve(Coerced).jsonSchema({ io: 'input' }).required).toBeUndefined();
    expect(resolve(Coerced).jsonSchema({ io: 'output' }).required).toEqual(['value']);
  });

  it('builds shorthand schemas', () => {
    const { Prop, resolve } = createTypeRegistry();

    class Shorthands {
      @Prop.string({ min: 2, max: 4, description: 'code' })
      code!: string;

      @Prop.string({ optional: true })
      note?: string;

      @Prop.string()
      plain!: string;

      @Prop.number({ integer: true, min: 1, max: 10 })
      rank!: number;

      @Prop.number({ optional: true })
      score?: number;

      @Prop.boolean()
      active!: boolean;

      @Prop.boolean({ optional: true })
      flagged?: boolean;

      @Prop.date()
      createdAt!: Date;

      @Prop.date({ optional: true })
      deletedAt?: Date;
    }

    const type = resolve(Shorthands);
    const valid = { code: 'ab', plain: 'p', rank: 3, active: true, createdAt: new Date(0) };

    expect(type.safeParse(valid).success).toBe(true);
    expect(type.fields.get('code')?.description).toBe('code');
    expect(type.safeParse({ ...valid, code: 'a' }).success).toBe(false);
    expect(type.safeParse({ ...valid, code: 'abcde' }).success).toBe(false);
    expect(type.safeParse({ ...valid, rank: 1.5 }).success).toBe(false);
    expect(type.safeParse({ ...valid, rank: 0 }).success).toBe(false);
    expect(type.safeParse({ ...valid, rank: 11 }).success).toBe(false);
    expect(type.safeParse({ ...valid, active: 'yes' }).success).toBe(false);
    expect(type.safeParse({ ...valid, createdAt: '1970-01-01' }).success).toBe(false);
    expect(type.safeParse({ ...valid, note: 'n', score: 1.5, flagged: false, deletedAt: new Date(1) }).success).toBe(
      true,
    );
  });

  it.each([
    ['strip', { a: 'x' }, true],
    ['strict', undefined, false],
    ['loose', { a: 'x', extra: 1 }, true],
  ] as const)('applies %s mode to unknown keys', (mode, expected, success) => {
    const { Type, Prop, resolve } = createTypeRegistry();

    @Type({ mode })
    class Moded {
      @Prop(z.string())
      a!: string;
    }

    const result = resolve(Moded).safeParse({ a: 'x', extra: 1 });
    expect(result.success).toBe(success);
    if (result.success) expect(result.data).toEqual(expected);
  });

  it('rejects an unknown mode', () => {
    const { Type, Prop, resolve } = createTypeRegistry();

    @Type({ mode: 'wild' as 'strict' })
    class Wild {
      @Prop(z.string())
      a!: string;
    }

    expect(() => resolve(Wild)).toThrow(/mode for Wild must be one of strip, strict, loose/);
  });

  it('resolves nested, array, and circular references', () => {
    const { Type, Prop, ref, resolve } = createTypeRegistry();

    @Type()
    class Address {
      @Prop(z.string())
      city!: string;
    }

    @Type()
    class TreeNode {
      @Prop(z.string())
      label!: string;

      @Prop(z.array(ref(() => TreeNode)))
      children!: TreeNode[];
    }

    @Type()
    class Person {
      @Prop.nested(() => Address)
      home!: Address;

      @Prop.nested(() => Address, { optional: true, description: 'Where they work' })
      work?: Address;

      @Prop(z.array(ref(() => Address)))
      previous!: Address[];
    }

    const person = resolve(Person);
    expect(person.safeParse({ home: { city: 'A' }, previous: [{ city: 'B' }] }).success).toBe(true);
    expect(person.safeParse({ home: { city: 1 }, previous: [] }).success).toBe(false);
    expect(person.safeParse({ home: { city: 'A' }, previous: [{}] }).success).toBe(false);
    expect(person.fields.get('work')?.description).toBe('Where they work');

    const tree = resolve(TreeNode);
    expect(tree.safeParse({ label: 'root', children: [{ label: 'leaf', children: [] }] }).success).toBe(true);
    expect(tree.safeParse({ label: 'root', children: [{ label: 'leaf' }] }).success).toBe(false);
    expect(tree.jsonSchema()).toMatchObject({
      properties: { children: { type: 'array', items: { $ref: '#' } } },
    });
  });

  it('reports an unregistered nested type when the reference is first used', () => {
    const { Prop, resolve } = createTypeRegistry();

    class Plain {}

    class Holder {
      @Prop.nested(() => Plain)
      plain!: Plain;
    }

    expect(() => resolve(Holder).parse({ plain: {} })).toThrow(/Plain is not a registered type/);
  });

  describe('inheritance', () => {
    it('inherits fields and lets a subclass redeclare one in place', () => {
      const { Type, Prop, resolve } = createTypeRegistry();

      @Type({ name: 'Base', mode: 'strict', description: 'base' })
      class Base {
        @Prop(z.string())
        id!: string;

        @Prop(z.string())
        status!: string;
      }

      class Derived extends Base {
        @Prop(z.enum(['open', 'closed']), { description: 'narrowed' })
        status!: 'open' | 'closed';

        @Prop(z.number())
        count!: number;
      }

      const derived = resolve(Derived);
      expect([...derived.fields.keys()]).toEqual(['id', 'status', 'count']);
      expect(derived.fields.get('status')?.description).toBe('narrowed');
      expect(derived.safeParse({ id: 'a', status: 'other', count: 1 }).success).toBe(false);
      expect(derived.safeParse({ id: 'a', status: 'open', count: 1 }).success).toBe(true);

      // Class-level options belong to the class that declares them.
      expect(derived.name).toBe('Derived');
      expect(derived.mode).toBe('strip');
      expect(derived.description).toBeUndefined();
      expect(resolve(Base).safeParse({ id: 'a', status: 'x', count: 1 }).success).toBe(false);
    });
  });

  describe('caching', () => {
    it('returns the same resolved type and shares schemas across registries from one root', () => {
      const root = createTypeRegistry();
      const composed = root.use({ key: 'tag', field: z.string() });
      const { Prop } = root;

      class Cached {
        @Prop(z.string())
        a!: string;
      }

      expect(root.resolve(Cached)).toBe(root.resolve(Cached));
      expect(composed.resolve(Cached)).not.toBe(root.resolve(Cached));
      expect(composed.resolve(Cached).object).toBe(root.resolve(Cached).object);
    });

    it('does not cache a failed resolution', () => {
      const { Prop, resolve } = createTypeRegistry();

      class Broken {
        @Prop(z.string())
        @Prop(z.string())
        a!: string;
      }

      expect(() => resolve(Broken)).toThrow(TypeRegistryError);
      expect(() => resolve(Broken)).toThrow(TypeRegistryError);
    });
  });

  describe('misuse', () => {
    it('rejects classes without decorations', () => {
      const { resolve } = createTypeRegistry();
      class Nothing {}

      expect(() => resolve(Nothing)).toThrow('Nothing is not a registered type: it has no @Type or @Prop decorations.');
    });

    it('accepts a @Type with no fields', () => {
      const { Type, resolve } = createTypeRegistry();

      @Type()
      class Empty {}

      expect(resolve(Empty).parse({ extra: 1 })).toEqual({});
    });

    it('rejects duplicate @Prop and @Type decorations', () => {
      const { Type, Prop, resolve } = createTypeRegistry();

      class TwiceProp {
        @Prop(z.string())
        @Prop(z.string())
        a!: string;
      }

      @Type()
      @Type()
      class TwiceType {}

      expect(() => resolve(TwiceProp)).toThrow('@Prop was applied more than once to field "a" (resolving TwiceProp).');
      expect(() => resolve(TwiceType)).toThrow('@Type was applied more than once to TwiceType.');
    });

    it('rejects static, symbol, private, and non-field members', () => {
      const { Prop } = createTypeRegistry();
      const sym = Symbol('sym');
      const decorate = (definition: () => unknown) => definition;

      expect(
        decorate(() => {
          class StaticField {
            @Prop(z.string())
            static value: string;
          }
          return StaticField;
        }),
      ).toThrow('@Prop cannot be used on static field "value"; types describe instance data.');

      expect(
        decorate(() => {
          class SymbolField {
            @Prop(z.string())
            [sym]!: string;
          }
          return SymbolField;
        }),
      ).toThrow('@Prop cannot be used on symbol field Symbol(sym); object schemas need string keys.');

      expect(
        decorate(() => {
          class PrivateField {
            @Prop(z.string())
            #secret!: string;
          }
          return PrivateField;
        }),
      ).toThrow(/cannot be used on private member "#secret"/);

      expect(
        decorate(() => {
          class MethodTarget {
            // @ts-expect-error @Prop is a field decorator
            @Prop(z.string())
            run(): void {}
          }
          return MethodTarget;
        }),
      ).toThrow(/can only be used on property targets, but was used on method/);
    });

    it('exposes structured details on errors', () => {
      const { Prop, resolve } = createTypeRegistry();

      class Dup {
        @Prop(z.string())
        @Prop(z.string())
        a!: string;
      }

      let caught: unknown;
      try {
        resolve(Dup);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(TypeRegistryError);
      expect(caught).toMatchObject({ name: 'TypeRegistryError', typeName: 'Dup', field: 'a' });
    });
  });

  it('supports destructuring and reports its namespace', () => {
    const registry = createTypeRegistry({ namespace: 'custom' });
    const { Type, Prop, resolve, ref } = registry;

    @Type()
    class Destructured {
      @Prop(z.array(ref(() => Destructured)))
      items!: Destructured[];
    }

    expect(registry.namespace).toBe('custom');
    expect(createTypeRegistry().namespace).toBe('types');
    expect(resolve(Destructured).safeParse({ items: [{ items: [] }] }).success).toBe(true);
  });
});
