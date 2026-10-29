import { createDecoratorRegistry } from '../index';

type SerializationDecorators = {
  class: {};
  property: {
    serializable: {
      metadata: undefined;
      target: unknown;
    };
  };
  method: {};
  accessor: {};
};

type UserContract = {
  id: string;
  email: string;
  passwordHash: string;
};

const registry = createDecoratorRegistry<SerializationDecorators>({ namespace: 'serialization-example' });
const User = registry.for<UserContract>();
const Serializable = User.property('serializable');

class UserRecord implements UserContract {
  @Serializable.on('id')
  id = 'user-1';

  @Serializable.on('email')
  email = 'ray@example.com';

  passwordHash = 'not-for-output';
}

export function serializeUser(user = new UserRecord()): Record<string, unknown> {
  const snapshot = registry.read(user);
  const output: Record<string, unknown> = {};

  for (const record of snapshot.propertyRecords('serializable')) {
    if (typeof record.memberName !== 'string') continue;
    output[record.memberName] = (user as unknown as Record<string, unknown>)[record.memberName];
  }

  return output;
}

export { UserRecord, registry as serializationRegistry };
