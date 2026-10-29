import { createDecoratorRegistry } from '../index';

type TestSchema = {
  class: {
    entity: { metadata: { table: string; nested?: { value: string } } };
    controller: { metadata: { prefix: string } };
  };
  property: {
    column: {
      metadata: { type: 'uuid' | 'varchar'; primary?: boolean; nested?: { value: string } };
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

type ControllerContract = {
  id: string;
  email: string;
  get(id: string): Promise<{ id: string }>;
};

function makeDecorators(namespace = 'test') {
  const registry = createDecoratorRegistry<TestSchema>({ namespace });
  const Scoped = registry.for<ControllerContract>();
  return {
    registry,
    Entity: Scoped.class('entity'),
    Controller: Scoped.class('controller'),
    Column: Scoped.property('column'),
    Serializable: Scoped.property('serializable'),
    Route: Scoped.method('route'),
    Cached: Scoped.accessor('cached'),
  };
}

describe('modern decorator registry', () => {
  it('creates an empty registry snapshot', () => {
    const { registry } = makeDecorators('empty');

    class Plain {}

    const snapshot = registry.read(Plain);
    expect(snapshot.all).toHaveLength(0);
    expect(snapshot.classes).toHaveLength(0);
    expect(snapshot.properties).toHaveLength(0);
    expect(snapshot.methods).toHaveLength(0);
    expect(snapshot.accessors).toHaveLength(0);
  });

  it('registers class, property, method, and accessor metadata', () => {
    const { registry, Entity, Column, Serializable, Route, Cached } = makeDecorators('all');

    @Entity({ table: 'users' })
    class UserController implements ControllerContract {
      @Column('id', { type: 'uuid', primary: true })
      id = 'user-1';

      @Serializable.on('email')
      @Column.on('email', { type: 'varchar' })
      email = 'ray@example.com';

      @Cached({ ttlMs: 50 })
      accessor displayName = 'Ray';

      @Route('get', { method: 'GET', path: '/users/:id' })
      async get(id: string): Promise<{ id: string }> {
        return { id };
      }
    }

    const snapshot = registry.read(UserController);

    expect(snapshot.firstClass('entity')?.metadata).toEqual({ table: 'users' });
    expect(snapshot.propertyRecords('column')).toHaveLength(2);
    expect(snapshot.propertyMap('column').get('id')?.[0].metadata).toEqual({
      type: 'uuid',
      primary: true,
    });
    expect(snapshot.propertyMap('serializable').get('email')).toHaveLength(1);
    expect(snapshot.methodMap('route').get('get')?.[0].metadata).toEqual({
      method: 'GET',
      path: '/users/:id',
    });
    expect(snapshot.accessorMap('cached').get('displayName')?.[0].metadata).toEqual({
      ttlMs: 50,
    });
  });

  it('reads metadata from an instance', () => {
    const { registry, Entity, Column, Route } = makeDecorators('instance');

    @Entity({ table: 'users' })
    class UserController implements ControllerContract {
      @Column({ type: 'uuid' })
      id = 'user-1';

      email = 'ray@example.com';

      @Route({ method: 'GET', path: '/users/:id' })
      async get(id: string): Promise<{ id: string }> {
        return { id };
      }
    }

    const snapshot = registry.read(new UserController());
    expect(snapshot.firstClass('entity')?.metadata).toEqual({ table: 'users' });
    expect(snapshot.propertyMap('column').get('id')).toHaveLength(1);
  });

  it('deep-clones and freezes metadata at registration time', () => {
    const { registry, Entity, Column } = makeDecorators('immutability');
    const classMetadata = { table: 'users', nested: { value: 'before' } };
    const columnMetadata = { type: 'varchar' as const, nested: { value: 'before' } };

    @Entity(classMetadata)
    class UserController implements ControllerContract {
      id = 'user-1';

      @Column(columnMetadata)
      email = 'ray@example.com';

      async get(id: string): Promise<{ id: string }> {
        return { id };
      }
    }

    classMetadata.nested.value = 'after';
    columnMetadata.nested.value = 'after';

    const snapshot = registry.read(UserController);
    const entityMetadata = snapshot.firstClass('entity')?.metadata as typeof classMetadata;
    const columnRecord = snapshot.propertyMap('column').get('email')?.[0];
    const storedColumnMetadata = columnRecord?.metadata as typeof columnMetadata;

    expect(entityMetadata.nested.value).toBe('before');
    expect(storedColumnMetadata.nested.value).toBe('before');
    expect(Object.isFrozen(entityMetadata)).toBe(true);
    expect(Object.isFrozen(entityMetadata.nested)).toBe(true);
    expect(Object.isFrozen(storedColumnMetadata)).toBe(true);
    expect(Object.isFrozen(storedColumnMetadata.nested)).toBe(true);
  });

  it('includes inherited metadata by default and can read own metadata only', () => {
    const { registry, Column, Serializable } = makeDecorators('inheritance');

    class BaseController {
      @Serializable()
      id = 'base-id';
    }

    class UserController extends BaseController implements ControllerContract {
      @Column({ type: 'varchar' })
      email = 'ray@example.com';

      async get(id: string): Promise<{ id: string }> {
        return { id };
      }
    }

    const inherited = registry.read(UserController);
    expect(inherited.propertyRecords('serializable')).toHaveLength(1);
    expect(inherited.propertyRecords('column')).toHaveLength(1);

    const ownOnly = registry.read(UserController, { includeInherited: false });
    expect(ownOnly.propertyRecords('serializable')).toHaveLength(0);
    expect(ownOnly.propertyRecords('column')).toHaveLength(1);
  });

  it('preserves symbol keys', () => {
    const { registry, Column } = makeDecorators('symbol');
    const secret = Symbol('secret');

    class SymbolExample {
      @Column({ type: 'varchar' })
      [secret] = 'hidden';
    }

    const snapshot = registry.read(SymbolExample);
    expect(snapshot.propertyRecords('column')[0].memberName).toBe(secret);
    expect(snapshot.propertyMap('column').get(secret)).toHaveLength(1);
  });

  it('rejects private members by default', () => {
    const { Column } = makeDecorators('private-reject');

    expect(() => {
      class PrivateExample {
        @Column({ type: 'varchar' })
        #secret = 'hidden';

        reveal() {
          return this.#secret;
        }
      }

      return PrivateExample;
    }).toThrow(/allowPrivateMembers/);
  });

  it('allows private members when configured', () => {
    const registry = createDecoratorRegistry<TestSchema>({
      namespace: 'private-allow',
      allowPrivateMembers: true,
    });
    const Column = registry.for<{ secret: string }>().property('column');

    class PrivateExample {
      @Column({ type: 'varchar' })
      #secret = 'hidden';

      reveal() {
        return this.#secret;
      }
    }

    const snapshot = registry.read(PrivateExample);
    expect(snapshot.propertyRecords('column')).toHaveLength(1);
    expect(snapshot.propertyRecords('column')[0].private).toBe(true);
  });

  it('marks static member records', () => {
    const { registry, Column, Route } = makeDecorators('static');

    class StaticExample {
      @Column({ type: 'varchar' })
      static tableName = 'users';

      @Route({ method: 'GET', path: '/health' })
      static async health(): Promise<{ id: string }> {
        return { id: 'ok' };
      }
    }

    expect(registry.read(StaticExample).propertyRecords('column')[0].static).toBe(true);
    expect(registry.read(StaticExample).methodRecords('route')[0].static).toBe(true);
  });

  it('isolates records by registry namespace and store', () => {
    type IsolatedSchema = {
      class: { marker: { metadata: { value: string } } };
      property: {};
      method: {};
      accessor: {};
    };

    const first = createDecoratorRegistry<IsolatedSchema>({ namespace: 'first' });
    const second = createDecoratorRegistry<IsolatedSchema>({ namespace: 'second' });
    const FirstMarker = first.for<object>().class('marker');
    const SecondMarker = second.for<object>().class('marker');

    @FirstMarker({ value: 'one' })
    @SecondMarker({ value: 'two' })
    class Marked {}

    expect(first.read(Marked).classes).toHaveLength(1);
    expect(second.read(Marked).classes).toHaveLength(1);
    expect(first.read(Marked).classes[0].id).toContain('first:class:marker');
    expect(second.read(Marked).classes[0].id).toContain('second:class:marker');
    expect(first.read(Marked).classes[0].metadata).toEqual({ value: 'one' });
    expect(second.read(Marked).classes[0].metadata).toEqual({ value: 'two' });
  });

  it('throws at runtime when a forced keyed decorator is applied to the wrong member', () => {
    const { Column } = makeDecorators('forced-key');
    const ForcedColumn = Column as unknown as (...args: unknown[]) => Function;

    expect(() => {
      class ForcedBadKey {
        @ForcedColumn('email', { type: 'varchar' })
        id = 'user-1';
      }

      return ForcedBadKey;
    }).toThrow(/keyed for/);
  });
});
