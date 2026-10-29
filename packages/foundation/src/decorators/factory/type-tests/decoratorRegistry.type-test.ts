import { createDecoratorRegistry } from '../index';

type UserDto = {
  id: string;
  email: string;
  age: number;
};

type CreateUserInput = {
  email: string;
  age: number;
};

interface UserControllerContract {
  id: string;
  email: string;
  age: number;
  getUser(id: string): Promise<UserDto>;
  createUser(input: CreateUserInput): Promise<UserDto>;
}

type AppDecorators = {
  class: {
    entity: {
      metadata: { table: string };
    };
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

const registry = createDecoratorRegistry<AppDecorators>();
const Entity = registry.class('entity');
const User = registry.for<UserControllerContract>();
const ScopedEntity = User.class('entity');
const Column = User.property('column');
const Serializable = User.property('serializable');
const Route = User.method('route');
const Cached = User.accessor('cached');

@Entity<UserControllerContract>({ table: 'users' })
class GoodUnscopedUserController implements UserControllerContract {
  id!: string;
  email!: string;
  age!: number;

  async getUser(id: string): Promise<UserDto> {
    return { id, email: this.email, age: this.age };
  }

  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email, age: input.age };
  }
}

// @ts-expect-error missing contract members
@Entity<UserControllerContract>({ table: 'users' })
class BadUnscopedUserController {}

// @ts-expect-error table must be string
@Entity<UserControllerContract>({ table: 123 })
class BadClassMetadataController implements UserControllerContract {
  id!: string;
  email!: string;
  age!: number;

  async getUser(id: string): Promise<UserDto> {
    return { id, email: this.email, age: this.age };
  }

  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email, age: input.age };
  }
}

@ScopedEntity({ table: 'users' })
class GoodScopedUserController implements UserControllerContract {
  @Column({ type: 'uuid', primary: true })
  id!: string;

  @Serializable()
  @Column('email', { type: 'varchar' })
  email!: string;

  age!: number;

  @Route({ method: 'GET', path: '/users/:id' })
  async getUser(id: string): Promise<UserDto> {
    return { id, email: this.email, age: this.age };
  }

  @Route.on('createUser', { method: 'POST', path: '/users' })
  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email, age: input.age };
  }
}

class BadPropertyMetadata implements UserControllerContract {
  // @ts-expect-error type must be uuid or varchar
  @Column({ type: 'int' })
  id!: string;

  email!: string;
  age!: number;

  async getUser(id: string): Promise<UserDto> {
    return { id, email: this.email, age: this.age };
  }

  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email, age: input.age };
  }
}

class BadPropertyTarget implements UserControllerContract {
  id!: string;
  email!: string;

  // @ts-expect-error column target is string but age is number
  @Column({ type: 'varchar' })
  age!: number;

  async getUser(id: string): Promise<UserDto> {
    return { id, email: this.email, age: this.age };
  }

  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email, age: input.age };
  }
}

class BadPropertyKey implements UserControllerContract {
  // @ts-expect-error decorator key does not match member name
  @Column('email', { type: 'varchar' })
  id!: string;

  email!: string;
  age!: number;

  async getUser(id: string): Promise<UserDto> {
    return { id, email: this.email, age: this.age };
  }

  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email, age: input.age };
  }
}

class BadNoMetadataArgs implements UserControllerContract {
  id!: string;

  // @ts-expect-error Serializable takes no metadata
  @Serializable({ enabled: true })
  email!: string;

  age!: number;

  async getUser(id: string): Promise<UserDto> {
    return { id, email: this.email, age: this.age };
  }

  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email, age: input.age };
  }
}

class BadRequiredMetadataArgs implements UserControllerContract {
  // @ts-expect-error Column requires metadata
  @Column()
  id!: string;

  email!: string;
  age!: number;

  async getUser(id: string): Promise<UserDto> {
    return { id, email: this.email, age: this.age };
  }

  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email, age: input.age };
  }
}

class BadMethodMetadata implements UserControllerContract {
  id!: string;
  email!: string;
  age!: number;

  // @ts-expect-error DELETE is not allowed
  @Route({ method: 'DELETE', path: '/users/:id' })
  async getUser(id: string): Promise<UserDto> {
    return { id, email: this.email, age: this.age };
  }

  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email, age: input.age };
  }
}

class BadMethodTarget {
  id!: string;
  email!: string;
  age!: number;

  // @ts-expect-error route target requires Promise return
  @Route({ method: 'GET', path: '/users/:id' })
  getUser(id: string): UserDto {
    return { id, email: this.email, age: this.age };
  }

  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email, age: input.age };
  }
}

class BadMethodKey implements UserControllerContract {
  id!: string;
  email!: string;
  age!: number;

  // @ts-expect-error decorator key does not match method name
  @Route('createUser', { method: 'GET', path: '/users/:id' })
  async getUser(id: string): Promise<UserDto> {
    return { id, email: this.email, age: this.age };
  }

  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email, age: input.age };
  }
}

class GoodAccessor implements UserControllerContract {
  id!: string;
  age!: number;

  @Cached('email', { ttlMs: 1000 })
  accessor email = 'Ray';

  async getUser(id: string): Promise<UserDto> {
    return { id, email: this.email, age: this.age };
  }

  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email, age: input.age };
  }
}

class BadAccessorTarget implements UserControllerContract {
  id!: string;
  email!: string;
  age!: number;

  // @ts-expect-error cached target is string but count is number
  @Cached({ ttlMs: 1000 })
  accessor count = 1;

  async getUser(id: string): Promise<UserDto> {
    return { id, email: this.email, age: this.age };
  }

  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email, age: input.age };
  }
}

class BadAccessorMetadata implements UserControllerContract {
  id!: string;
  email!: string;
  age!: number;

  // @ts-expect-error ttlMs must be number
  @Cached({ ttlMs: '1000' })
  accessor label = 'Ray';

  async getUser(id: string): Promise<UserDto> {
    return { id, email: this.email, age: this.age };
  }

  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email, age: input.age };
  }
}
