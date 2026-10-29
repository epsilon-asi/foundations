import { createDecoratorRegistry } from '../index';

type RouteDecorators = {
  class: {
    controller: {
      metadata: { prefix: string };
    };
  };
  property: {};
  method: {
    route: {
      metadata: { method: 'GET' | 'POST'; path: string };
      target: (...args: any[]) => Promise<unknown>;
    };
  };
  accessor: {};
};

type UserDto = { id: string; email: string };
type CreateUserInput = { email: string };

type UserControllerContract = {
  getUser(id: string): Promise<UserDto>;
  createUser(input: CreateUserInput): Promise<UserDto>;
};

const registry = createDecoratorRegistry<RouteDecorators>({ namespace: 'route-example' });
const User = registry.for<UserControllerContract>();

const Controller = User.class('controller');
const Route = User.method('route');

@Controller({ prefix: '/api' })
class UserController implements UserControllerContract {
  @Route('getUser', { method: 'GET', path: '/users/:id' })
  async getUser(id: string): Promise<UserDto> {
    return { id, email: 'ray@example.com' };
  }

  @Route.on('createUser', { method: 'POST', path: '/users' })
  async createUser(input: CreateUserInput): Promise<UserDto> {
    return { id: 'new-id', email: input.email };
  }
}

export type RouteEntry = {
  httpMethod: 'GET' | 'POST';
  path: string;
  handlerName: string | symbol;
};

export function buildRouteTable(): RouteEntry[] {
  const snapshot = registry.read(UserController);
  const controller = snapshot.firstClass('controller');
  if (controller === undefined) throw new Error('Missing @Controller metadata.');

  const prefix = (controller.metadata as { prefix: string }).prefix;

  return snapshot.methodRecords('route').map((record) => {
    if (record.memberName === undefined) throw new Error('Route record missing member.');
    const metadata = record.metadata as { method: 'GET' | 'POST'; path: string };
    return {
      httpMethod: metadata.method,
      path: `${prefix}${metadata.path}`,
      handlerName: record.memberName,
    };
  });
}

export { UserController, registry as routeRegistry };
