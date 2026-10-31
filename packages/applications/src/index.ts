/*
import { createDecoratorRegistry } from "@epsilon-asi/foundation/decorators/factory";


type CrudController<TEntity, TCreateInput> = {
    id: string;
    get(id: string): Promise<TEntity>;
    create(input: TCreateInput): Promise<TEntity>;
};

type UserDto = {
    id: string;
    email: string;
};

type CreateUserInput = {
    email: string;
};

type UserCrudController = CrudController<UserDto, CreateUserInput>;

type CrudDecorators = {
    class: {
        resource: {
            metadata: { name: string };
        };
    };
    property: {
        idField: {
            metadata: undefined;
            target: string;
        };
    };
    method: {
        route: {
            metadata: { method: 'GET' | 'POST'; path: string };
            target: (...args: any[]) => Promise<unknown>;
        };
    };
    accessor: {};
};

const registry = createDecoratorRegistry<CrudDecorators>({ namespace: 'crud-example' });
const Crud = registry.for<UserCrudController>();

const Resource = Crud.class('resource');
const IdField = Crud.property('idField');
const Route = Crud.method('route');

@Resource({ name: 'users' })
class UserCrud implements UserCrudController {
    @IdField.on('id')
    id = 'user-1';

    @Route('get', { method: 'GET', path: '/users/:id' })
    async get(id: string): Promise<UserDto> {
        return { id, email: 'ray@example.com' };
    }

    @Route.on('create', { method: 'POST', path: '/users' })
    async create(input: CreateUserInput): Promise<UserDto> {
        return { id: 'new-id', email: input.email };
    }
}

export function buildCrudSummary(): { resource: string; routes: string[]; idFields: Array<string | symbol> } {
    const snapshot = registry.read(UserCrud);
    const resource = snapshot.firstClass('resource');
    if (resource === undefined) throw new Error('Missing @Resource metadata.');

    return {
        resource: (resource.metadata as { name: string }).name,
        routes: snapshot.methodRecords('route').map((record) => {
            const metadata = record.metadata as { method: 'GET' | 'POST'; path: string };
            return `${metadata.method} ${metadata.path}`;
        }),
        idFields: snapshot.propertyRecords('idField').map((record) => {
            if (record.memberName === undefined) throw new Error('Missing member name.');
            return record.memberName;
        }),
    };
}

export { UserCrud, registry as crudRegistry };
*/
