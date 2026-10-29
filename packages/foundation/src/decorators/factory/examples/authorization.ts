import { createDecoratorRegistry } from '../index';

type Role = 'admin' | 'support' | 'user';

type AuthorizationDecorators = {
  class: {
    resource: {
      metadata: { name: string };
    };
  };
  property: {};
  method: {
    requireRole: {
      metadata: { roles: Role[] };
      target: (...args: any[]) => Promise<unknown>;
    };
  };
  accessor: {};
};

type AccountAdminContract = {
  viewAccount(id: string): Promise<{ id: string }>;
  suspendAccount(id: string): Promise<{ id: string; suspended: true }>;
};

const registry = createDecoratorRegistry<AuthorizationDecorators>({ namespace: 'authorization-example' });
const Account = registry.for<AccountAdminContract>();

const Resource = Account.class('resource');
const RequireRole = Account.method('requireRole');

@Resource({ name: 'account' })
class AccountAdminController implements AccountAdminContract {
  @RequireRole.on('viewAccount', { roles: ['support', 'admin'] })
  async viewAccount(id: string): Promise<{ id: string }> {
    return { id };
  }

  @RequireRole('suspendAccount', { roles: ['admin'] })
  async suspendAccount(id: string): Promise<{ id: string; suspended: true }> {
    return { id, suspended: true };
  }
}

export type AccessPolicy = {
  resource: string;
  permissions: Array<{
    handlerName: string | symbol;
    roles: Role[];
  }>;
};

export function buildAccessPolicy(): AccessPolicy {
  const snapshot = registry.read(AccountAdminController);
  const resource = snapshot.firstClass('resource');
  if (resource === undefined) throw new Error('Missing @Resource metadata.');

  return {
    resource: (resource.metadata as { name: string }).name,
    permissions: snapshot.methodRecords('requireRole').map((record) => {
      if (record.memberName === undefined) throw new Error('Role record missing member.');
      const metadata = record.metadata as { roles: Role[] };
      return {
        handlerName: record.memberName,
        roles: metadata.roles,
      };
    }),
  };
}

export { AccountAdminController, registry as authorizationRegistry };
