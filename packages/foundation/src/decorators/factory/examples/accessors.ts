import { createDecoratorRegistry } from '../index';

type ViewDecorators = {
  class: {};
  property: {};
  method: {};
  accessor: {
    cached: {
      metadata: { ttlMs?: number };
      target: string;
    };
  };
};

type UserViewContract = {
  displayName: string;
};

const registry = createDecoratorRegistry<ViewDecorators>({ namespace: 'accessor-example' });
const View = registry.for<UserViewContract>();
const Cached = View.accessor('cached');

class UserView implements UserViewContract {
  @Cached('displayName', { ttlMs: 1000 })
  accessor displayName = 'Ray';
}

export function readAccessorMetadata(): { memberName: string | symbol; ttlMs: number | undefined }[] {
  return registry.read(UserView).accessorRecords('cached').map((record) => {
    if (record.memberName === undefined) throw new Error('Missing member name.');
    return {
      memberName: record.memberName,
      ttlMs: (record.metadata as { ttlMs?: number }).ttlMs,
    };
  });
}

export { UserView, registry as accessorRegistry };
