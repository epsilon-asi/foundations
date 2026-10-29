import { createDecoratorRegistry } from '../index';
import { ensureSymbolMetadata, symbolMetadata } from '../symbolMetadata';

type EdgeSchema = {
  class: {
    entity: { metadata: { table: string } };
    tag: { metadata: undefined };
  };
  property: {
    column: {
      metadata: { type: 'uuid' | 'varchar'; primary?: boolean };
      target: string;
    };
    serializable: {
      metadata: undefined;
      target: unknown;
    };
  };
  method: {
    route: {
      metadata: { method: 'GET' | 'POST'; path: string };
      target: (...args: any[]) => Promise<unknown>;
    };
  };
  accessor: {
    cached: {
      metadata: { ttlMs?: number };
      target: string;
    };
  };
};

type EdgeContract = {
  id: string;
  email: string;
  displayName: string;
  get(id: string): Promise<{ id: string }>;
};

function fakeMetadataContext(
  kind: 'class' | 'field' | 'method' | 'accessor' | 'getter' | 'setter',
  overrides: Partial<
    ClassDecoratorContext | ClassFieldDecoratorContext | ClassMethodDecoratorContext | ClassAccessorDecoratorContext
  > = {},
) {
  return {
    kind,
    name: kind === 'class' ? 'FakeClass' : 'member',
    static: false,
    private: false,
    metadata: {},
    addInitializer: jest.fn(),
    access: {},
    ...overrides,
  } as any;
}

describe('modern decorator registry edge coverage', () => {
  it('uses default options and returns empty snapshots for objects without constructors', () => {
    const registry = createDecoratorRegistry<EdgeSchema>();
    const targetWithoutConstructor = Object.create(null);

    expect(registry.namespace).toBe('default');
    expect(registry.allowPrivateMembers).toBe(false);
    expect(registry.read(targetWithoutConstructor).all).toHaveLength(0);
  });

  it('supports unscoped class decorators and no-metadata class decorators', () => {
    const registry = createDecoratorRegistry<EdgeSchema>({ namespace: 'unscoped' });
    const Entity = registry.class('entity');
    const Tag = registry.class('tag') as unknown as () => ClassDecorator;

    @Entity<EdgeContract>({ table: 'users' })
    @Tag()
    class UserController implements EdgeContract {
      id = 'user-1';
      email = 'ray@example.com';
      displayName = 'Ray';

      async get(id: string): Promise<{ id: string }> {
        return { id };
      }
    }

    const snapshot = registry.read(UserController);
    expect(snapshot.classRecords()).toHaveLength(2);
    expect(snapshot.firstClass('entity')?.metadata).toEqual({ table: 'users' });
    expect(snapshot.firstClass('tag')?.metadata).toBeUndefined();
    expect(snapshot.classes.map((record) => record.id)).toEqual([
      'unscoped:class:tag:0',
      'unscoped:class:entity:1',
    ]);
  });

  it('supports direct and .on keyed forms for property, method, and accessor decorators', () => {
    const registry = createDecoratorRegistry<EdgeSchema>({ namespace: 'keyed-forms' });
    const scoped = registry.for<EdgeContract>();
    const Column = scoped.property('column');
    const Serializable = scoped.property('serializable');
    const Route = scoped.method('route');

    class UserController implements EdgeContract {
      @Column('id', { type: 'uuid', primary: true })
      id = 'user-1';

      @Serializable.on('email')
      @Column.on('email', { type: 'varchar' })
      email = 'ray@example.com';

      displayName = 'Ray';

      @Route.on('get', { method: 'GET', path: '/users/:id' })
      async get(id: string): Promise<{ id: string }> {
        return { id };
      }
    }

    const snapshot = registry.read(UserController);
    expect(snapshot.propertyMap('column').get('id')?.[0].metadata).toEqual({
      type: 'uuid',
      primary: true,
    });
    expect(snapshot.propertyMap('serializable').get('email')?.[0].metadata).toBeUndefined();
    expect(snapshot.methodMap('route').get('get')?.[0].metadata).toEqual({
      method: 'GET',
      path: '/users/:id',
    });
  });

  it('records getter and setter decorators as accessor metadata', () => {
    const registry = createDecoratorRegistry<EdgeSchema>({ namespace: 'getter-setter' });
    const Cached = registry.for<EdgeContract>().accessor('cached');

    class UserView {
      private name = 'Ray';

      @Cached({ ttlMs: 10 })
      get displayName(): string {
        return this.name;
      }

      @Cached({ ttlMs: 20 })
      set displayName(value: string) {
        this.name = value;
      }
    }

    const records = registry.read(UserView).accessorMap('cached').get('displayName');
    expect(records).toHaveLength(2);
    expect(records?.map((record) => record.metadata)).toEqual([{ ttlMs: 10 }, { ttlMs: 20 }]);
  });

  it('throws for invalid direct keys and invalid .on arguments', () => {
    const registry = createDecoratorRegistry<EdgeSchema>({ namespace: 'bad-keys' });
    const Column = registry.for<EdgeContract>().property('column') as unknown as {
      (...args: unknown[]): unknown;
      on(...args: unknown[]): unknown;
    };

    expect(() => Column(123, { type: 'varchar' })).toThrow(/expected a string or symbol/);
    expect(() => Column.on()).toThrow(/requires a member key/);
    expect(() => Column.on({ not: 'a-key' }, { type: 'varchar' })).toThrow(
      /expected a string or symbol/,
    );
  });

  it('throws when decorators are manually applied to the wrong context kind', () => {
    const registry = createDecoratorRegistry<EdgeSchema>({ namespace: 'wrong-kind' });
    const scoped = registry.for<EdgeContract>();
    const Entity = scoped.class('entity');
    const Column = scoped.property('column');
    const Route = scoped.method('route');
    const Cached = scoped.accessor('cached');

    expect(() =>
      (Entity({ table: 'users' }) as any)(class Fake {}, fakeMetadataContext('method')),
    ).toThrow(/can only be used on class targets/);

    expect(() =>
      (Column({ type: 'varchar' }) as any)(undefined, fakeMetadataContext('method')),
    ).toThrow(/can only be used on property targets/);

    expect(() =>
      (Route({ method: 'GET', path: '/x' }) as any)(async () => undefined, fakeMetadataContext('field')),
    ).toThrow(/can only be used on method targets/);

    expect(() =>
      (Cached({ ttlMs: 1 }) as any)(undefined, fakeMetadataContext('field')),
    ).toThrow(/can only be used on accessor targets/);
  });

  it('throws when a keyed decorator is applied to a different member at runtime', () => {
    const registry = createDecoratorRegistry<EdgeSchema>({ namespace: 'runtime-key-mismatch' });
    const Column = registry.for<EdgeContract>().property('column') as unknown as (...args: unknown[]) => any;
    const decorator = Column('email', { type: 'varchar' });

    expect(() =>
      decorator(undefined, fakeMetadataContext('field', { name: 'id' })),
    ).toThrow(/keyed for/);
  });

  it('allows manually decorated private members when configured', () => {
    const registry = createDecoratorRegistry<EdgeSchema>({
      namespace: 'manual-private',
      allowPrivateMembers: true,
    });
    const Column = registry.for<EdgeContract>().property('column');
    const metadataObject = {};
    const decorator = Column({ type: 'varchar' });

    (decorator as any)(undefined, fakeMetadataContext('field', {
      name: '#secret',
      private: true,
      metadata: metadataObject,
    }));

    const Manual = class {};
    Object.defineProperty(Manual, symbolMetadata, {
      configurable: true,
      value: metadataObject,
    });

    const record = registry.read(Manual).propertyRecords('column')[0];
    expect(record.private).toBe(true);
    expect(record.memberName).toBe('#secret');
  });

  it('accepts manually applied getter and setter contexts for accessor decorators', () => {
    const registry = createDecoratorRegistry<EdgeSchema>({ namespace: 'manual-accessor-kinds' });
    const Cached = registry.for<EdgeContract>().accessor('cached');
    const metadataObject = {};

    (Cached({ ttlMs: 1 }) as any)(() => 'Ray', fakeMetadataContext('getter', {
      name: 'displayName',
      metadata: metadataObject,
    }));
    (Cached({ ttlMs: 2 }) as any)((_value: string) => undefined, fakeMetadataContext('setter', {
      name: 'displayName',
      metadata: metadataObject,
    }));

    const Manual = class {};
    Object.defineProperty(Manual, symbolMetadata, {
      configurable: true,
      value: metadataObject,
    });

    expect(registry.read(Manual).accessorRecords('cached').map((record) => record.metadata)).toEqual([
      { ttlMs: 1 },
      { ttlMs: 2 },
    ]);
  });

  it('reuses Symbol.metadata once the polyfill has been installed', () => {
    const first = ensureSymbolMetadata();
    const second = ensureSymbolMetadata();

    expect(first).toBe(second);
    expect(first).toBe(symbolMetadata);
    expect((Symbol as SymbolConstructor & { metadata?: symbol }).metadata).toBe(symbolMetadata);
  });
});
